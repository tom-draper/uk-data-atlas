import { randomUUID } from "node:crypto";
import { copyFileSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { observationBuildPath } from "./observation-build-path";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";
import { geographyCatalogues } from "@uk-data-atlas/atlas-runtime/areas";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

export function assembleAtlas(root: string) {
	const path = join(root, "data/build/atlas.sqlite");
	const component = observationBuildPath(root);
	const payloads = JSON.parse(
		readFileSync(join(root, "data/build/geography-payloads.json"), "utf8"),
	) as Array<{ id: string; payload: string }>;
	const temporary = `${path}.observations.${randomUUID()}.tmp`;
	try {
		copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database
				.prepare("ATTACH DATABASE ? AS observations_component")
				.run(component);
			database
				.prepare("ATTACH DATABASE ? AS postcode_component")
				.run(join(root, "data/build/postcode-index.sqlite"));
			const objects = database
				.prepare(
					"SELECT type, name, sql FROM observations_component.sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
				)
				.all() as Array<{ type: string; name: string; sql: string }>;
			const existing = database
				.prepare(
					"SELECT type, name FROM main.sqlite_schema WHERE type IN ('table', 'view') AND (name LIKE 'observation\\_%' ESCAPE '\\' OR name = 'observations' OR name LIKE 'observations\\_%' ESCAPE '\\') ORDER BY type DESC",
				)
				.all() as Array<{ type: string; name: string }>;
			const hasObservations = existing.some(
				({ type, name }) => type === "table" && name === "observations",
			);
			const observationNames = new Set(
				existing
					.filter(({ type }) => type === "table")
					.map(({ name }) => name),
			);
			const previousStats =
				hasObservations &&
				database
					.prepare(
						"SELECT 1 FROM main.sqlite_schema WHERE name = 'sqlite_stat1'",
					)
					.get()
					? database
							.prepare(
								"SELECT tbl, idx, stat FROM main.sqlite_stat1",
							)
							.all()
							.filter(
								({ tbl }) => !observationNames.has(String(tbl)),
							)
					: null;
			database.exec(
				"PRAGMA foreign_keys = OFF; PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN",
			);
			for (const { type, name } of existing)
				database.exec(`DROP ${type} ${quote(name)}`);
			for (const object of objects.filter(
				({ type }) => type === "table",
			)) {
				database.exec(object.sql);
				database.exec(
					`INSERT INTO main.${quote(object.name)} SELECT * FROM observations_component.${quote(object.name)}`,
				);
			}
			for (const object of objects.filter(
				({ type }) => type === "index" || type === "view",
			))
				database.exec(object.sql);
			database.exec("COMMIT; ANALYZE");
			if (previousStats) {
				const stats = database
					.prepare(
						"SELECT tbl, idx, stat FROM observations_component.sqlite_stat1",
					)
					.all();
				database.exec("DELETE FROM main.sqlite_stat1");
				const insert = database.prepare(
					"INSERT INTO main.sqlite_stat1 VALUES (?, ?, ?)",
				);
				for (const row of [...previousStats, ...stats])
					insert.run(row.tbl!, row.idx!, row.stat!);
			}
			const insertPayload = database.prepare(
				"INSERT OR REPLACE INTO payloads (id, payload) VALUES (?, ?)",
			);
			database.exec("BEGIN");
			for (const { id, payload } of payloads)
				insertPayload.run(id, payload);
			const postcode = database
				.prepare(
					"SELECT payload FROM postcode_component.payloads WHERE id = 'postcode-index'",
				)
				.get();
			const existingPostcode = database
				.prepare(
					"SELECT payload FROM main.payloads WHERE id = 'postcode-index'",
				)
				.get();
			const hasPostcodes = database
				.prepare(
					"SELECT 1 FROM main.sqlite_schema WHERE type = 'table' AND name = 'postcodes'",
				)
				.get();
			const sameIndex =
				hasPostcodes &&
				existingPostcode?.payload === postcode?.payload &&
				!database
					.prepare(
						`
				SELECT 1 FROM main.postcodes p LEFT JOIN postcode_component.postcodes i ON i.postcode = p.postcode
				WHERE i.postcode IS NULL OR p.easting IS NOT i.easting OR p.northing IS NOT i.northing
				OR p.quality IS NOT i.quality OR p.country IS NOT i.country OR p.introduced IS NOT i.introduced
				OR p.terminated IS NOT i.terminated OR p.largeUser IS NOT i.largeUser LIMIT 1
			`,
					)
					.get() &&
				database
					.prepare(
						"SELECT (SELECT COUNT(*) FROM main.postcodes) = (SELECT COUNT(*) FROM postcode_component.postcodes) AS equal",
					)
					.get()?.equal === 1;
			if (!sameIndex) {
				database.exec(
					"DROP VIEW IF EXISTS main.postcodes_decoded; DROP TABLE IF EXISTS main.postcodes",
				);
				const schema = database
					.prepare(
						"SELECT sql FROM postcode_component.sqlite_schema WHERE type = 'table' AND name = 'postcodes'",
					)
					.get();
				database.exec(String(schema!.sql));
				database.exec(
					"INSERT INTO main.postcodes SELECT * FROM postcode_component.postcodes",
				);
			}
			insertPayload.run("postcode-index", postcode!.payload!);
			database.exec("COMMIT");
			database.exec("VACUUM");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	for (const id of geographyCatalogues)
		rmSync(join(artifactDirectory(root), `${id}.json`), { force: true });
	const publicRoot = artifactDirectory(root);
	rmSync(join(publicRoot, "postcodes"), { recursive: true, force: true });
	for (const filename of ["postcode-index.json", "postcode-index.json.gz"])
		rmSync(join(publicRoot, filename), { force: true });
	return path;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath)
	console.log(
		`Assembled atlas components into ${assembleAtlas(resolve(dirname(scriptPath), "../.."))}`,
	);
