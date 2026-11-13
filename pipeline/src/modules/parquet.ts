import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";

/**
 * Parquet output of the module build (docs/database-roadmap.md, tasks 16 and
 * 19): one folder per module, zstd, and a DuckDB views file. DuckDB reads the
 * module's SQLite file through its `sqlite` extension, so the Parquet holds
 * the same rows and ids as the file it sits beside.
 */

const text = (value: string) => `'${value.replaceAll("'", "''")}'`;
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/**
 * Writes `<table>.parquet` for each table into `folder`. One thread keeps the
 * rows in the order SQLite scans them, so a rerun writes the same bytes.
 */
export const exportParquet = async (
	sqlite: string,
	folder: string,
	tables: readonly string[],
): Promise<void> => {
	mkdirSync(folder, { recursive: true });
	const instance = await DuckDBInstance.create(":memory:", { threads: "1" });
	const connection = await instance.connect();
	try {
		await connection.run("LOAD sqlite");
		await connection.run(
			`ATTACH ${text(sqlite)} AS module (TYPE SQLITE, READ_ONLY)`,
		);
		for (const table of tables)
			await connection.run(
				`COPY (SELECT * FROM module.${quote(table)}) TO ${text(join(folder, `${table}.parquet`))} (FORMAT PARQUET, COMPRESSION ZSTD)`,
			);
	} finally {
		connection.closeSync();
		instance.closeSync();
	}
};
