import type { DatabaseSync } from "node:sqlite";
import { schemaDocs, type SchemaDocs, type TableDoc } from "./schemaDocs.ts";

/**
 * Writes the documentation of `atlas.sqlite` into the file, so a reader can
 * learn the tables, columns and worked queries by querying it.
 */

type Column = { table: string; column: string; description: string };

type Resolved = {
	tables: Array<{
		name: string;
		kind: "table" | "view";
		doc: TableDoc;
	}>;
	columns: Column[];
	problems: string[];
};

/** The tables and views of the main schema, without SQLite's own and FTS shadow tables. */
const objectsOf = (database: DatabaseSync) =>
	(
		database
			.prepare(
				"SELECT name, type FROM pragma_table_list WHERE schema = 'main' AND name NOT LIKE 'sqlite_%' AND type IN ('table', 'view', 'virtual') ORDER BY name",
			)
			.all() as Array<{ name: string; type: string }>
	).map(({ name, type }) => ({
		name,
		kind: type === "view" ? ("view" as const) : ("table" as const),
	}));

const columnsOf = (database: DatabaseSync, table: string) =>
	(
		database
			.prepare("SELECT name FROM pragma_table_info(?) ORDER BY cid")
			.all(table) as Array<{ name: string }>
	).map(({ name }) => name);

/**
 * Matches the docs against the tables the writers created, and returns the
 * rows to store with every difference found. A difference is a table, view
 * or column (of a core or reference table) with no description, or a
 * description of one that does not exist.
 */
export const resolveSchemaDocs = (
	database: DatabaseSync,
	docs: SchemaDocs = schemaDocs,
): Resolved => {
	const problems: string[] = [];
	const objects = objectsOf(database);
	const present = new Set(objects.map(({ name }) => name));
	for (const name of Object.keys(docs.tables))
		if (!present.has(name))
			problems.push(`Documented table or view ${name} does not exist`);
	const tables: Resolved["tables"] = [];
	const columns: Column[] = [];
	for (const { name, kind } of objects) {
		const doc = docs.tables[name];
		if (!doc?.description.trim()) {
			problems.push(`Table or view ${name} has no description`);
			continue;
		}
		tables.push({ name, kind, doc });
		const actual = columnsOf(database, name);
		const known = new Set(actual);
		for (const column of Object.keys(doc.columns))
			if (!known.has(column))
				problems.push(
					`Documented column ${name}.${column} does not exist`,
				);
		const used = new Set<string>();
		for (const column of actual) {
			const own = doc.columns[column];
			const pattern = doc.columnPatterns?.find(
				({ suffix }) =>
					column.endsWith(suffix) && column.length > suffix.length,
			);
			const description = own ?? pattern?.description;
			if (pattern && own === undefined) used.add(pattern.pattern);
			if (description?.trim())
				columns.push({ table: name, column, description });
			else if (doc.audience !== "internal")
				problems.push(`Column ${name}.${column} has no description`);
		}
		for (const { pattern } of doc.columnPatterns ?? [])
			if (!used.has(pattern))
				problems.push(
					`Column pattern ${name}.${pattern} matches no column`,
				);
	}
	return { tables, columns, problems };
};

const SCHEMA_TABLES = `
CREATE TABLE schema_table (
	name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('table', 'view')),
	audience TEXT NOT NULL CHECK (audience IN ('core', 'reference', 'internal')),
	description TEXT NOT NULL,
	PRIMARY KEY (name)
) WITHOUT ROWID, STRICT;
CREATE TABLE schema_column (
	table_name TEXT NOT NULL REFERENCES schema_table(name),
	column_name TEXT NOT NULL,
	description TEXT NOT NULL,
	PRIMARY KEY (table_name, column_name)
) WITHOUT ROWID, STRICT;
CREATE TABLE schema_guide (
	topic TEXT NOT NULL,
	position INTEGER NOT NULL UNIQUE,
	body TEXT NOT NULL,
	PRIMARY KEY (topic)
) WITHOUT ROWID, STRICT;
CREATE TABLE schema_example (
	id TEXT NOT NULL,
	position INTEGER NOT NULL UNIQUE,
	question TEXT NOT NULL,
	sql TEXT NOT NULL,
	expect TEXT NOT NULL,
	PRIMARY KEY (id)
) WITHOUT ROWID, STRICT`;

/**
 * Creates and fills `schema_table`, `schema_column`, `schema_guide` and
 * `schema_example`, after every other table exists. Throws, listing every
 * difference, when the docs and the tables disagree.
 */
export function writeSchemaDocs(
	database: DatabaseSync,
	docs: SchemaDocs = schemaDocs,
): void {
	database.exec(SCHEMA_TABLES);
	const { tables, columns, problems } = resolveSchemaDocs(database, docs);
	if (problems.length > 0)
		throw new Error(
			`The schema docs do not match the database (pipeline/src/storage/schemaDocs.ts):\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
		);
	const addTable = database.prepare(
		"INSERT INTO schema_table (name, kind, audience, description) VALUES (?, ?, ?, ?)",
	);
	for (const { name, kind, doc } of tables)
		addTable.run(name, kind, doc.audience, doc.description);
	const addColumn = database.prepare(
		"INSERT INTO schema_column (table_name, column_name, description) VALUES (?, ?, ?)",
	);
	for (const { table, column, description } of columns)
		addColumn.run(table, column, description);
	const addTopic = database.prepare(
		"INSERT INTO schema_guide (topic, position, body) VALUES (?, ?, ?)",
	);
	docs.guide.forEach(({ topic, body }, index) =>
		addTopic.run(topic, index + 1, body),
	);
	const addExample = database.prepare(
		"INSERT INTO schema_example (id, position, question, sql, expect) VALUES (?, ?, ?, ?, ?)",
	);
	docs.examples.forEach(({ id, question, sql, expect }, index) =>
		addExample.run(id, index + 1, question, sql, expect),
	);
}
