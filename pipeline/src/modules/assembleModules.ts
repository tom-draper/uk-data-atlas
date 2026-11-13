import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { publishVacuumed } from "../storage/publishVacuumed.ts";
import { MODULE_INFO_TABLE, readSchema } from "./moduleTables.ts";
import { sha256OfFile, sqlitePath } from "./buildModules.ts";

/**
 * Joins core and the chosen modules into one self-contained SQLite file
 * (docs/database-roadmap.md, tasks 19 and 23). SQLite attaches at most 10
 * databases to a connection and has no foreign keys across files, so a
 * purchase is one file in which every foreign key is checked.
 *
 * The result is a function of the files: the modules are applied in id order,
 * no time or path is written, and the file is vacuumed. The same inputs give
 * the same bytes.
 */

/** The parts of a published module manifest the assembler reads. */
interface ManifestFacts {
	id: string;
	compatibility: { core: string };
	/** Modules this one needs beside core; absent in manifests written before add-ons. */
	requires?: string[];
	licenceConflict: { shareAlike: string[]; others: string[] } | null;
	licences: Array<{ id: string }> | null;
}

export interface AssembleModulesOptions {
	/** A release tree or build output holding `sqlite/atlas-<id>.sqlite` and manifests. */
	root: string;
	/** Module ids to add to core. Core is always included. */
	modules: readonly string[];
	/** Where the assembled file is written. */
	out: string;
	/**
	 * Allows a module that holds share-alike data beside data without that
	 * term. No module has one since `politics-sharealike` was split out, but a
	 * new source can raise it again. The licence ids are written to `meta`.
	 */
	allowLicenceConflict?: boolean;
}

export interface AssembledModules {
	out: string;
	modules: string[];
	/** Views not created because a module they read is not in the file. */
	skippedViews: string[];
}

export class AssembleError extends Error {}

export const manifestFilePath = (id: string) =>
	`sqlite/atlas-${id}.manifest.json`;

const readManifest = (root: string, id: string): ManifestFacts => {
	const path = join(root, manifestFilePath(id));
	if (!existsSync(path))
		throw new AssembleError(`Module ${id} has no manifest at ${path}.`);
	const manifest = JSON.parse(readFileSync(path, "utf8")) as ManifestFacts;
	if (manifest.id !== id)
		throw new AssembleError(
			`The manifest at ${path} is for module ${String(manifest.id)}, not ${id}.`,
		);
	return manifest;
};

const infoOf = (database: DatabaseSync, schema = "main") =>
	Object.fromEntries(
		(
			database
				.prepare(
					`SELECT key, value FROM ${schema}.${MODULE_INFO_TABLE}`,
				)
				.all() as Array<{ key: string; value: string }>
		).map(({ key, value }) => [key, value]),
	);

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

export const assembleModules = async ({
	root,
	modules,
	out,
	allowLicenceConflict = false,
}: AssembleModulesOptions): Promise<AssembledModules> => {
	const ids = [...new Set(modules.filter((id) => id !== "core"))].sort();
	if (ids.length === 0)
		throw new AssembleError("Name at least one module to add to core.");
	const corePath = join(root, sqlitePath("core"));
	if (!existsSync(corePath))
		throw new AssembleError(`Core is not built: ${corePath} is missing.`);

	const core = new DatabaseSync(corePath, { readOnly: true });
	let coreKey: string | undefined;
	try {
		coreKey = infoOf(core)["coreCompatibility"];
	} finally {
		core.close();
	}
	const problems: string[] = [];
	const licences = new Set<string>();
	const conflicted: string[] = [];
	for (const id of ids) {
		const file = join(root, sqlitePath(id));
		if (!existsSync(file)) {
			problems.push(`${id}: ${file} is missing (not built).`);
			continue;
		}
		const manifest = readManifest(root, id);
		const database = new DatabaseSync(file, { readOnly: true });
		let fileKey: string | undefined;
		try {
			fileKey = infoOf(database)["coreCompatibility"];
		} finally {
			database.close();
		}
		for (const [where, key] of [
			["manifest", manifest.compatibility?.core],
			["database", fileKey],
		] as const)
			if (key !== coreKey)
				problems.push(
					`${id}: its ${where} needs core ${String(key)}, this core is ${String(coreKey)}.`,
				);
		for (const required of manifest.requires ?? [])
			if (required !== "core" && !ids.includes(required))
				problems.push(
					`${id}: it adds to ${required}, which is not in this assembly. Add ${required} too.`,
				);
		for (const licence of manifest.licences ?? []) licences.add(licence.id);
		if (manifest.licenceConflict) conflicted.push(id);
	}
	if (problems.length > 0)
		throw new AssembleError(
			`Cannot assemble these modules with this core:\n${problems.join("\n")}`,
		);
	if (conflicted.length > 0 && !allowLicenceConflict)
		throw new AssembleError(
			`${conflicted.join(", ")} hold data under licences that cannot be offered as one unit (share-alike beside other terms). Pass allowLicenceConflict to assemble them anyway.`,
		);

	const work = `${out}.work`;
	rmSync(work, { force: true });
	copyFileSync(corePath, work);
	const skippedViews: string[] = [];
	const hashes: Record<string, string> = {};
	const database = new DatabaseSync(work);
	try {
		// Rows are copied table by table; the check at the end covers every key.
		database.exec(
			"PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA foreign_keys = OFF",
		);
		const created = new Set<string>();
		const indexes: string[] = [];
		for (const id of ids) {
			const file = join(root, sqlitePath(id));
			hashes[id] = await sha256OfFile(file);
			database.prepare("ATTACH DATABASE ? AS part").run(file);
			database.exec("BEGIN");
			try {
				for (const row of readSchema(database, "part")) {
					if (row.type === "table") {
						if (row.name === "payloads") {
							database.exec(
								"INSERT INTO main.payloads SELECT * FROM part.payloads",
							);
							continue;
						}
						if (row.name === MODULE_INFO_TABLE) continue;
						if (!created.has(row.name)) {
							database.exec(row.sql);
							created.add(row.name);
						}
						database.exec(
							`INSERT INTO main.${quote(row.name)} SELECT * FROM part.${quote(row.name)}`,
						);
					} else if (
						row.type === "index" &&
						!indexes.includes(row.sql)
					)
						indexes.push(row.sql);
				}
				database.exec("COMMIT");
			} finally {
				if (database.isTransaction) database.exec("ROLLBACK");
				database.exec("DETACH DATABASE part");
			}
		}
		database.exec("BEGIN");
		for (const sql of indexes) database.exec(sql);
		const have = new Set(
			(
				database
					.prepare(
						"SELECT name FROM main.sqlite_schema WHERE type = 'table'",
					)
					.all() as Array<{ name: string }>
			).map(({ name }) => name),
		);
		const views = database
			.prepare(
				"SELECT name, sql, requires FROM module_view ORDER BY position",
			)
			.all() as Array<{ name: string; sql: string; requires: string }>;
		for (const view of views)
			if (view.requires.split(",").every((table) => have.has(table)))
				database.exec(view.sql);
			else skippedViews.push(view.name);
		const mark = database.prepare(
			"UPDATE module SET installed = 1 WHERE id = ?",
		);
		for (const id of ids) mark.run(id);
		const meta = database.prepare(
			"INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
		);
		meta.run("assembledModules", ids.join(","));
		meta.run("coreCompatibility", coreKey ?? "");
		meta.run("assembledLicences", [...licences].sort().join(","));
		for (const id of ids) meta.run(`moduleSha256:${id}`, hashes[id]!);
		database.exec("COMMIT");
		const broken = database.prepare("PRAGMA foreign_key_check").all();
		if (broken.length > 0)
			throw new AssembleError(
				`${broken.length} rows break a foreign key after assembly, first: ${JSON.stringify(broken[0])}`,
			);
	} finally {
		database.close();
	}
	try {
		publishVacuumed(work, out);
	} finally {
		rmSync(work, { force: true });
	}
	return { out, modules: ids, skippedViews };
};
