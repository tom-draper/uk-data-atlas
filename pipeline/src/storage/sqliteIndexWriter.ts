import { renameSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { writeSqliteTables, type SqliteTable } from "@uk-data-atlas/artifacts";

/**
 * Write tables, each keyed by `position`, and a key-value `meta` table. The
 * file is written beside its path and moved into place once complete. It is
 * not vacuumed: it is a component, and the database published from it is
 * vacuumed once, at that publish step.
 */
export const writeSqliteIndex = (
	path: string,
	meta: Record<string, string>,
	tables: Record<string, SqliteTable>,
	/** Smaller pages waste less on values that overflow them. */
	pageSize = 4096,
) => {
	const temporary = `${path}.tmp`;
	rmSync(temporary, { force: true });
	const database = new DatabaseSync(temporary);
	try {
		database.exec(
			`PRAGMA foreign_keys = ON; PRAGMA page_size = ${pageSize}; PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN;`,
		);
		database.exec(
			"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
		);
		const insertMeta = database.prepare("INSERT INTO meta VALUES (?, ?)");
		for (const [key, value] of Object.entries(meta))
			insertMeta.run(key, value);
		writeSqliteTables(database, tables);
		database.exec("COMMIT");
	} finally {
		database.close();
	}
	renameSync(temporary, path);
};
