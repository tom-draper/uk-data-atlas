import { renameSync, rmSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { buildMetadataPathOf, packText } from "@uk-data-atlas/atlas-db";
import { writeSqliteTables, type SqliteTable } from "@uk-data-atlas/artifacts";

/**
 * The payload documents of a build, one row per document, compressed with
 * `packText`. They are the JSON the API loads whole (inventories, catalogues
 * and the postcode index), kept beside the database and not in it.
 */
export const payloadTable = (
	rows: Iterable<readonly [id: string, text: string]>,
): SqliteTable => ({
	strict: true,
	columns: ["id TEXT NOT NULL", "payload BLOB NOT NULL"],
	key: ["id"],
	rows: (function* (): Generator<SQLInputValue[]> {
		for (const [id, text] of rows) yield [id, packText(text)];
	})(),
});

/**
 * Write the build metadata of the database at `databasePath` to the file
 * beside it, whole and renamed into place so a reader sees the old file or
 * the new one. The file is written in one pass and is not vacuumed.
 */
export function writeBuildMetadata(
	databasePath: string,
	tables: Record<string, SqliteTable>,
): string {
	const path = buildMetadataPathOf(databasePath);
	const temporary = `${path}.tmp`;
	rmSync(temporary, { force: true });
	try {
		const database = new DatabaseSync(temporary);
		try {
			database.exec(
				"PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN",
			);
			writeSqliteTables(database, tables);
			database.exec("COMMIT");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	return path;
}
