import type { DatabaseSync } from "node:sqlite";

/**
 * Which file of the module build holds each table of `atlas.sqlite`
 * (docs/database-roadmap.md, tasks 19 to 23). Core assigns every id and holds
 * everything modules point at: areas, releases, crosswalks, periods,
 * measures, dimensions, sources, parties, the catalogue and denominators. A
 * theme module holds only its own datasets, series and observations, and
 * `postcodes` holds the postcode tables. A module never points at another.
 */

/** The tables a theme module owns, in the order their rows can be inserted. */
export interface ModuleTable {
	readonly table: string;
	/** Rows of the table the module owns. The helper tables are in `ownerTables`. */
	readonly where: string;
}

export const DATASET_TABLES: readonly ModuleTable[] = [
	{ table: "dataset", where: "id IN (SELECT id FROM temp.owned_dataset)" },
	{ table: "series", where: "id IN (SELECT id FROM temp.owned_series)" },
	{
		table: "series_member",
		where: "series_id IN (SELECT id FROM temp.owned_series)",
	},
	{
		table: "observation",
		where: "series_id IN (SELECT id FROM temp.owned_series)",
	},
	{
		table: "dataset_area_key",
		where: "dataset_id IN (SELECT id FROM temp.owned_dataset)",
	},
	{
		table: "dataset_area_name",
		where: "dataset_id IN (SELECT id FROM temp.owned_dataset)",
	},
	{
		table: "series_input",
		where: "series_id IN (SELECT id FROM temp.owned_series)",
	},
	{
		table: "series_conversion",
		where: "series_id IN (SELECT id FROM temp.owned_series)",
	},
	{
		table: "series_crosswalk",
		where: "series_id IN (SELECT id FROM temp.owned_series)",
	},
	{
		table: "series_gap",
		where: "series_id IN (SELECT id FROM temp.owned_series)",
	},
	{
		table: "conversion_skip",
		where: "dataset_id IN (SELECT id FROM temp.owned_dataset)",
	},
	{
		table: "area_relationship",
		where: "dataset_id IN (SELECT id FROM temp.owned_dataset)",
	},
	{
		table: "election",
		where: "dataset_id IN (SELECT id FROM temp.owned_dataset)",
	},
	{
		table: "contest",
		where: "election_id IN (SELECT id FROM temp.owned_election)",
	},
	{
		table: "candidacy",
		where: "contest_id IN (SELECT id FROM temp.owned_contest)",
	},
];

/** Postcode tables share this prefix. */
export const POSTCODE_TABLE = /^postcode/;

/** Payload rows that belong to the `postcodes` module, not to core. */
export const POSTCODE_PAYLOADS = ["postcode-index", "postcode-areas"] as const;

/**
 * Measures whose totals are copied into core, so a rate can be rebuilt from a
 * module and a denominator without a second module (docs/data-organisation.md,
 * "Modules"). Only series with no dimension are copied: the totals, not the
 * age and sex breakdowns, which are most of the observations. No declaration
 * flags a denominator yet, so the list is kept here.
 */
export const DENOMINATOR_MEASURES = [
	"area",
	"households",
	"population",
	"usual-residents",
	"usual-residents-16-plus",
] as const;

/** Tables the module build adds to core. */
export const CORE_ADDED_TABLES = [
	"module",
	"module_dataset",
	"module_view",
	"core_denominator",
] as const;

export const MODULE_INFO_TABLE = "module_info";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

interface SchemaRow {
	type: string;
	name: string;
	tbl_name: string;
	sql: string;
}

/** Every table, index and view of a database, in the order it was created. */
export const readSchema = (database: DatabaseSync, schema = "main") =>
	(
		database
			.prepare(
				`SELECT type, name, tbl_name, sql FROM ${quote(schema)}.sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid`,
			)
			.all() as unknown as SchemaRow[]
	).map((row) => ({ ...row }));

/** The module that owns a table, or `core` when none does. */
export const tableOwner = (table: string): "dataset" | "postcodes" | "core" => {
	if (DATASET_TABLES.some((owned) => owned.table === table)) return "dataset";
	if (POSTCODE_TABLE.test(table)) return "postcodes";
	return "core";
};

/** Whether the SQL names the table as a word, not as part of another name. */
const mentions = (sql: string, name: string) =>
	new RegExp(`(^|[^A-Za-z0-9_])"?${name}"?($|[^A-Za-z0-9_])`).test(sql);

/**
 * Splits the views of `atlas.sqlite` into those core can hold on its own and
 * those that read a module's tables, which the assembler creates once the
 * modules they need are present. A view reading another such view needs the
 * same tables.
 */
export const classifyViews = (
	schema: readonly SchemaRow[],
): { core: SchemaRow[]; module: Array<SchemaRow & { requires: string[] }> } => {
	const moduleTables = schema
		.filter(
			(row) => row.type === "table" && tableOwner(row.name) !== "core",
		)
		.map((row) => row.name);
	const views = schema.filter((row) => row.type === "view");
	const requires = new Map<string, Set<string>>();
	for (const view of views) {
		requires.set(
			view.name,
			new Set(moduleTables.filter((table) => mentions(view.sql, table))),
		);
	}
	for (let changed = true; changed;) {
		changed = false;
		for (const view of views)
			for (const other of views) {
				if (other === view || !mentions(view.sql, other.name)) continue;
				const needed = requires.get(view.name)!;
				for (const table of requires.get(other.name)!)
					if (!needed.has(table)) {
						needed.add(table);
						changed = true;
					}
			}
	}
	return {
		core: views.filter((view) => requires.get(view.name)!.size === 0),
		module: views
			.filter((view) => requires.get(view.name)!.size > 0)
			.map((view) => ({
				...view,
				requires: [...requires.get(view.name)!].sort(),
			})),
	};
};
