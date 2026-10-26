import type { DatabaseSync, SQLInputValue } from "node:sqlite";

export type SqliteTable = {
	columns: string[];
	/**
	 * The columns a row is found by. Without them, rows are keyed by
	 * `position`, one per position in order.
	 */
	key?: string[];
	rowid?: boolean;
	rows:
		| Iterable<SQLInputValue[]>
		| ((database: DatabaseSync) => Iterable<SQLInputValue[]>);
	constraints?: string[];
	/** Reject values that do not match their column's declared type. */
	strict?: boolean;
	indexes?: string[][];
	views?: Record<string, string>;
};

/** Write declared tables into a database owned by the caller's transaction. */
export const writeSqliteTables = (
	database: DatabaseSync,
	tables: Record<string, SqliteTable>,
) => {
	for (const [name, table] of Object.entries(tables)) {
		const placeholders = table.columns.map(() => "?");
		const strict = table.strict ? "STRICT" : "";
		if (table.key) {
			const options = [table.rowid ? "" : "WITHOUT ROWID", strict]
				.filter(Boolean)
				.join(", ");
			database.exec(
				`CREATE TABLE ${name} (${[...table.columns, ...(table.constraints ?? [])].join(", ")}, PRIMARY KEY (${table.key.join(", ")})) ${options}`,
			);
			const insert = database.prepare(
				`INSERT INTO ${name} VALUES (${placeholders.join(", ")})`,
			);
			for (const row of typeof table.rows === "function"
				? table.rows(database)
				: table.rows)
				insert.run(...row);
			for (const [index, columns] of (table.indexes ?? []).entries())
				database.exec(
					`CREATE INDEX ${name}_${index} ON ${name} (${columns.join(", ")})`,
				);
			continue;
		}
		database.exec(
			`CREATE TABLE ${name} (position INTEGER PRIMARY KEY, ${table.columns.join(", ")}) ${strict}`,
		);
		const insert = database.prepare(
			`INSERT INTO ${name} VALUES (${["?", ...placeholders].join(", ")})`,
		);
		let position = 0;
		for (const row of typeof table.rows === "function"
			? table.rows(database)
			: table.rows)
			insert.run(position++, ...row);
	}
	for (const table of Object.values(tables))
		for (const [name, select] of Object.entries(table.views ?? {}))
			database.exec(`CREATE VIEW ${name} AS ${select}`);
};
