import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, rmSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	CORE_COMPATIBILITY_KEY,
	DATASET_SPLIT_MODULES,
	type ModuleBuild,
	type ModuleBuildFile,
	type ModuleManifest,
} from "@uk-data-atlas/datasets/registry";
import { publishVacuumed } from "../storage/publishVacuumed.ts";
import {
	type ModuleTable,
	DATASET_TABLES,
	DENOMINATOR_MEASURES,
	LICENSED_ROW_TABLES,
	MODULE_INFO_TABLE,
	POSTCODE_PAYLOADS,
	classifyViews,
	readSchema,
	tableOwner,
} from "./moduleTables.ts";

/**
 * Splits `atlas.sqlite` into a core file and one file per module
 * (docs/database-roadmap.md, tasks 19 to 23). Ids are already stable across
 * the split: core assigns them (`pipeline/ids`) and the rows keep the ids they
 * have in `atlas.sqlite`, so a module attached to core, or assembled with it,
 * answers the same queries.
 *
 * Each file holds the verbatim DDL of its tables, so a column is never
 * restated here. Foreign keys that name core tables are kept in the DDL and
 * are checked when the assembler joins the files, not in a module on its own.
 */

export const sqlitePath = (id: string) => `sqlite/atlas-${id}.sqlite`;
export const parquetFolder = (id: string) => `${id}/parquet`;

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Tables only core adds, created before the module data is known. */
export const CORE_ADDED_DDL = [
	`CREATE TABLE module (id TEXT NOT NULL PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('theme','foundation')), label TEXT NOT NULL, description TEXT NOT NULL, always_included INTEGER NOT NULL CHECK (always_included IN (0,1)), installed INTEGER NOT NULL DEFAULT 0 CHECK (installed IN (0,1))) STRICT, WITHOUT ROWID`,
	`CREATE TABLE module_dataset (module_id TEXT NOT NULL REFERENCES module(id), dataset TEXT NOT NULL, title TEXT NOT NULL, topic TEXT NOT NULL, PRIMARY KEY (module_id, dataset)) STRICT, WITHOUT ROWID`,
	`CREATE TABLE module_view (name TEXT NOT NULL PRIMARY KEY, position INTEGER NOT NULL, sql TEXT NOT NULL, requires TEXT NOT NULL) STRICT, WITHOUT ROWID`,
	`CREATE TABLE core_denominator (series_id INTEGER NOT NULL, dataset_id INTEGER NOT NULL, measure_id INTEGER NOT NULL REFERENCES measure(id), release_id INTEGER NOT NULL REFERENCES area_releases(id), area_version_id INTEGER NOT NULL REFERENCES area_version(id), period_id INTEGER NOT NULL REFERENCES period(id), value REAL, status_id INTEGER NOT NULL REFERENCES status(id), lower REAL, upper REAL, PRIMARY KEY (series_id, area_version_id, period_id)) STRICT, WITHOUT ROWID`,
] as const;

export const MODULE_INFO_DDL = `CREATE TABLE ${MODULE_INFO_TABLE} (key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL) STRICT, WITHOUT ROWID`;

/** Reads a database that this build never writes. */
const attachSource = (database: DatabaseSync, atlasPath: string) => {
	database.prepare("ATTACH DATABASE ? AS src").run(atlasPath);
};

export const sha256OfFile = (path: string): Promise<string> =>
	new Promise((resolve, reject) => {
		const hash = createHash("sha256");
		createReadStream(path)
			.on("data", (chunk) => hash.update(chunk))
			.on("error", reject)
			.on("end", () => resolve(hash.digest("hex")));
	});

export const fileFact = async (
	root: string,
	path: string,
	format: ModuleBuildFile["format"],
): Promise<ModuleBuildFile> => {
	const { size } = await stat(join(root, path));
	return {
		path,
		format,
		bytes: size,
		sha256: await sha256OfFile(join(root, path)),
	};
};

/** Rows per table of a finished file, in table-name order. */
export const countRows = (database: DatabaseSync): Record<string, number> => {
	const counts: Record<string, number> = {};
	const tables = database
		.prepare(
			"SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
		)
		.all() as Array<{ name: string }>;
	for (const { name } of tables)
		counts[name] = Number(
			(
				database
					.prepare(`SELECT count(*) AS n FROM ${quote(name)}`)
					.get() as { n: number }
			).n,
		);
	return counts;
};

/** Runs `build` against an empty working database, then publishes it vacuumed. */
const publish = (
	path: string,
	build: (database: DatabaseSync) => void,
): void => {
	mkdirSync(dirname(path), { recursive: true });
	const work = `${path}.work`;
	rmSync(work, { force: true });
	const database = new DatabaseSync(work);
	try {
		// Foreign keys name rows of core, which a module file does not hold.
		database.exec(
			"PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA foreign_keys = OFF",
		);
		database.exec("BEGIN");
		build(database);
		database.exec("COMMIT");
	} finally {
		database.close();
	}
	try {
		publishVacuumed(work, path);
	} finally {
		rmSync(work, { force: true });
	}
};

type SchemaRow = ReturnType<typeof readSchema>[number];

const ownedBy = (row: SchemaRow, keep: (table: string) => boolean) =>
	keep(row.type === "index" ? row.tbl_name : row.name);

const createSchema = (
	database: DatabaseSync,
	rows: readonly SchemaRow[],
	keep: (table: string) => boolean,
) => {
	for (const row of rows.filter((row) => row.type === "table"))
		if (keep(row.name)) database.exec(row.sql);
	for (const row of rows.filter((row) => row.type === "index"))
		if (ownedBy(row, keep)) database.exec(row.sql);
};

const copyTable = (database: DatabaseSync, table: string, where?: string) => {
	database.exec(
		`INSERT INTO main.${quote(table)} SELECT * FROM src.${quote(table)}${where ? ` WHERE ${where}` : ""}`,
	);
};

/** The `licensed-rows` split a module is, if it is one. */
const addOnOf = (moduleId: string) =>
	DATASET_SPLIT_MODULES.find(
		(split) => split.id === moduleId && split.holds === "licensed-rows",
	);

/** The `licensed-rows` splits that take rows out of a module. */
const withheldFrom = (moduleId: string) =>
	DATASET_SPLIT_MODULES.filter(
		(split) =>
			split.holds === "licensed-rows" &&
			(split.requires as readonly string[]).includes(moduleId),
	);

/**
 * The temp tables naming the rows a theme module owns. A `licensed-rows`
 * add-on owns the datasets it adds rows to, and takes only the licensed rows
 * of them (`markLicensed`); every other module owns the datasets homed in it.
 */
const markOwned = (database: DatabaseSync, moduleId: string) => {
	const addOn = addOnOf(moduleId);
	const owned = addOn
		? `slug IN (${addOn.datasets.map(literal).join(", ")})`
		: `module = ${literal(moduleId)}`;
	database.exec(
		`CREATE TEMP TABLE owned_dataset AS SELECT id FROM src.dataset WHERE ${owned};
		 CREATE TEMP TABLE owned_series AS SELECT id FROM src.series WHERE dataset_id IN (SELECT id FROM owned_dataset);
		 CREATE TEMP TABLE owned_election AS SELECT id FROM src.election WHERE dataset_id IN (SELECT id FROM owned_dataset);
		 CREATE TEMP TABLE owned_contest AS SELECT id FROM src.contest WHERE election_id IN (SELECT id FROM owned_election)`,
	);
};

/**
 * The temp tables naming the rows a licensed-rows split holds: the elections
 * of its datasets polled in its date range, and what hangs off them. Filled for
 * the add-on and for the module it takes the rows from, so the two select
 * complementary rows.
 */
const markLicensed = (
	database: DatabaseSync,
	splits: ReadonlyArray<{
		datasets: readonly string[];
		electionDates?: { from: string; to: string };
	}>,
) => {
	const licensed = splits.flatMap((split) =>
		split.electionDates
			? split.datasets.map(
					(slug) =>
						`(d.slug = ${literal(slug)} AND e.date BETWEEN ${literal(split.electionDates!.from)} AND ${literal(split.electionDates!.to)})`,
				)
			: [],
	);
	database.exec(
		`CREATE TEMP TABLE licensed_election AS SELECT e.id, e.date FROM src.election e
		   JOIN src.dataset d ON d.id = e.dataset_id
		  WHERE ${licensed.join(" OR ") || "0"};
		 CREATE TEMP TABLE licensed_dataset AS SELECT DISTINCT e.dataset_id AS id FROM src.election e WHERE e.id IN (SELECT id FROM licensed_election);
		 CREATE TEMP TABLE licensed_series AS SELECT id FROM src.series WHERE dataset_id IN (SELECT id FROM licensed_dataset);
		 CREATE TEMP TABLE licensed_contest AS SELECT id FROM src.contest WHERE election_id IN (SELECT id FROM licensed_election);
		 CREATE TEMP TABLE licensed_period AS SELECT id FROM src.period WHERE label IN (SELECT date FROM licensed_election)`,
	);
};

/** Fails when the periods of licensed rows are not the election dates they are read from. */
const checkLicensedPeriods = (database: DatabaseSync, moduleId: string) => {
	const missing = database
		.prepare(
			"SELECT count(*) AS n FROM temp.licensed_election WHERE date NOT IN (SELECT label FROM src.period)",
		)
		.get() as { n: number };
	if (Number(missing.n) > 0)
		throw new Error(
			`Module ${moduleId}: ${missing.n} licensed elections have no period labelled with their date, so their observations cannot be told apart.`,
		);
};

/** Fails when a module's rows point at a row of another module. */
const checkSelfContained = (database: DatabaseSync, moduleId: string) => {
	const stray = database
		.prepare(
			"SELECT count(*) AS n FROM src.series WHERE id IN (SELECT id FROM temp.owned_series) AND derived_from_id IS NOT NULL AND derived_from_id NOT IN (SELECT id FROM temp.owned_series)",
		)
		.get() as { n: number };
	const inputs = database
		.prepare(
			"SELECT count(*) AS n FROM src.series_input WHERE series_id IN (SELECT id FROM temp.owned_series) AND input_series_id NOT IN (SELECT id FROM temp.owned_series)",
		)
		.get() as { n: number };
	if (Number(inputs.n) > 0)
		throw new Error(
			`Module ${moduleId}: ${inputs.n} series take an input from a series of another module. A module points only at core.`,
		);
	if (Number(stray.n) > 0)
		throw new Error(
			`Module ${moduleId}: ${stray.n} series are derived from a series of another module. A module points only at core.`,
		);
};

/** The dataset slugs the registry places in a module, against those built. */
const checkDatasets = (
	database: DatabaseSync,
	manifest: ModuleManifest,
): void => {
	const built = (
		database
			.prepare(
				"SELECT slug FROM src.dataset WHERE id IN (SELECT id FROM temp.owned_dataset) ORDER BY slug",
			)
			.all() as Array<{ slug: string }>
	).map(({ slug }) => slug);
	const declared = new Set(manifest.datasets.map(({ id }) => id));
	const stray = built.filter((slug) => !declared.has(slug));
	if (stray.length > 0)
		throw new Error(
			`Module ${manifest.id} holds datasets its manifest does not list: ${stray.join(", ")}`,
		);
};

const moduleInfo = (
	database: DatabaseSync,
	values: Record<string, string>,
): void => {
	database.exec(MODULE_INFO_DDL);
	const insert = database.prepare(
		`INSERT INTO ${MODULE_INFO_TABLE} (key, value) VALUES (?, ?)`,
	);
	for (const [key, value] of Object.entries(values).sort(([a], [b]) =>
		a < b ? -1 : 1,
	))
		insert.run(key, value);
};

/** The module's own tables and how to select the rows it owns. */
const moduleSelection = (id: string) => {
	if (id === "postcodes")
		return (table: string) => tableOwner(table) === "postcodes";
	if (addOnOf(id))
		return (table: string) =>
			LICENSED_ROW_TABLES.some((licensed) => licensed.table === table);
	return (table: string) =>
		DATASET_TABLES.some((owned) => owned.table === table);
};

/**
 * Which rows of each table a theme module copies. A module a licensed-rows
 * split takes from leaves those rows out, and the add-on takes exactly them.
 */
const rowSelection = (id: string): readonly ModuleTable[] => {
	const addOn = addOnOf(id);
	if (addOn) return LICENSED_ROW_TABLES;
	if (withheldFrom(id).length === 0) return DATASET_TABLES;
	return DATASET_TABLES.map((owned) => {
		const licensed = LICENSED_ROW_TABLES.find(
			({ table }) => table === owned.table,
		);
		return licensed
			? {
					table: owned.table,
					where: `(${owned.where}) AND NOT (${licensed.where})`,
				}
			: owned;
	});
};

/** Builds the SQLite file of one theme module or of `postcodes`. */
export const buildModuleDatabase = (
	atlasPath: string,
	manifest: ModuleManifest,
	path: string,
): void =>
	publish(path, (database) => {
		attachSource(database, atlasPath);
		const schema = readSchema(database, "src");
		const keep = moduleSelection(manifest.id);
		createSchema(database, schema, keep);
		if (manifest.id === "postcodes") {
			for (const row of schema)
				if (row.type === "table" && keep(row.name))
					copyTable(database, row.name);
			database.exec(
				`CREATE TABLE payloads (id TEXT NOT NULL, payload BLOB NOT NULL, PRIMARY KEY (id)) WITHOUT ROWID`,
			);
			copyTable(
				database,
				"payloads",
				`id IN (${POSTCODE_PAYLOADS.map(literal).join(", ")})`,
			);
		} else {
			markOwned(database, manifest.id);
			const addOn = addOnOf(manifest.id);
			const withheld = withheldFrom(manifest.id);
			if (addOn || withheld.length > 0) {
				markLicensed(database, addOn ? [addOn] : withheld);
				checkLicensedPeriods(database, manifest.id);
			}
			checkDatasets(database, manifest);
			checkSelfContained(database, manifest.id);
			for (const { table, where } of rowSelection(manifest.id))
				copyTable(database, table, where);
		}
		moduleInfo(database, {
			id: manifest.id,
			coreCompatibility: CORE_COMPATIBILITY_KEY,
			kind: manifest.kind,
			requires: manifest.requires.join(","),
		});
	});

const isPostcodePayload = `id IN (${POSTCODE_PAYLOADS.map(literal).join(", ")})`;

/** Builds the core file: foundation tables, the module catalogue and denominators. */
export const buildCoreDatabase = (
	atlasPath: string,
	manifests: readonly ModuleManifest[],
	path: string,
): void =>
	publish(path, (database) => {
		attachSource(database, atlasPath);
		const schema = readSchema(database, "src");
		const keep = (table: string) => tableOwner(table) === "core";
		createSchema(database, schema, keep);
		for (const row of schema)
			if (row.type === "table" && keep(row.name))
				copyTable(
					database,
					row.name,
					row.name === "payloads"
						? `NOT (${isPostcodePayload})`
						: undefined,
				);
		const views = classifyViews(schema);
		for (const view of views.core) database.exec(view.sql);
		for (const ddl of CORE_ADDED_DDL) database.exec(ddl);
		const insertModule = database.prepare(
			"INSERT INTO module (id, kind, label, description, always_included, installed) VALUES (?, ?, ?, ?, ?, ?)",
		);
		const insertDataset = database.prepare(
			"INSERT INTO module_dataset (module_id, dataset, title, topic) VALUES (?, ?, ?, ?)",
		);
		for (const manifest of [...manifests].sort((a, b) =>
			a.id < b.id ? -1 : 1,
		)) {
			insertModule.run(
				manifest.id,
				manifest.kind,
				manifest.label,
				manifest.description,
				manifest.alwaysIncluded ? 1 : 0,
				manifest.id === "core" ? 1 : 0,
			);
			for (const dataset of manifest.datasets)
				insertDataset.run(
					manifest.id,
					dataset.id,
					dataset.title,
					dataset.topic,
				);
		}
		const insertView = database.prepare(
			"INSERT INTO module_view (name, position, sql, requires) VALUES (?, ?, ?, ?)",
		);
		// Position keeps a view after the views it reads.
		views.module.forEach((view, position) =>
			insertView.run(
				view.name,
				position,
				view.sql,
				view.requires.join(","),
			),
		);
		database.exec(
			`INSERT INTO core_denominator SELECT s.id, s.dataset_id, s.measure_id, s.release_id, o.area_version_id, o.period_id, o.value, o.status_id, o.lower, o.upper
			 FROM src.series s
			 JOIN src.measure m ON m.id = s.measure_id
			 JOIN src.observation o ON o.series_id = s.id
			 WHERE m.slug IN (${DENOMINATOR_MEASURES.map(literal).join(", ")})
			   AND NOT EXISTS (SELECT 1 FROM src.series_member sm WHERE sm.series_id = s.id)
			 ORDER BY s.id, o.area_version_id, o.period_id`,
		);
		moduleInfo(database, {
			id: "core",
			coreCompatibility: CORE_COMPATIBILITY_KEY,
			kind: "foundation",
		});
	});

export interface BuildModulesOptions {
	/** The `atlas.sqlite` to split. */
	atlasPath: string;
	/** Receives `sqlite/` and, with Parquet, one folder per module. */
	outDir: string;
	manifests: readonly ModuleManifest[];
	/** Parquet export; a DuckDB-free build leaves it out. */
	exportParquet?: (
		sqlite: string,
		folder: string,
		tables: readonly string[],
	) => Promise<void>;
}

/** Modules that have SQLite content. `boundaries` is GeoParquet and not built here. */
export const buildableModules = (manifests: readonly ModuleManifest[]) =>
	manifests.filter((manifest) => manifest.id !== "boundaries");

/**
 * Builds core and every module found in the manifests. Each result records the
 * size and SHA-256 of its files, and the rows per table of its SQLite file.
 */
export const buildModules = async ({
	atlasPath,
	outDir,
	manifests,
	exportParquet,
}: BuildModulesOptions): Promise<Record<string, ModuleBuild>> => {
	const results: Record<string, ModuleBuild> = {};
	for (const manifest of buildableModules(manifests)) {
		const relative = sqlitePath(manifest.id);
		const target = join(outDir, relative);
		if (manifest.id === "core")
			buildCoreDatabase(atlasPath, manifests, target);
		else buildModuleDatabase(atlasPath, manifest, target);
		const database = new DatabaseSync(target, { readOnly: true });
		let rows: Record<string, number>;
		try {
			rows = countRows(database);
		} finally {
			database.close();
		}
		const files: ModuleBuildFile[] = [
			await fileFact(outDir, relative, "sqlite"),
		];
		if (exportParquet) {
			const folder = parquetFolder(manifest.id);
			rmSync(join(outDir, folder), { recursive: true, force: true });
			const tables = Object.keys(rows).filter(
				(table) =>
					table !== "payloads" &&
					table !== MODULE_INFO_TABLE &&
					(manifest.id !== "core" || tableOwner(table) === "core"),
			);
			await exportParquet(target, join(outDir, folder), tables);
			for (const table of tables)
				files.push(
					await fileFact(
						outDir,
						`${folder}/${table}.parquet`,
						"parquet",
					),
				);
		}
		results[manifest.id] = {
			status: "built",
			bytes: files[0]!.bytes,
			files,
			rows,
		};
	}
	return results;
};
