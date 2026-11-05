import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

/**
 * Stages that write into a database shared with other stages leave a stamp
 * here. The data build tracks the stamp as the stage's output, so the stage's
 * digest is what its own tables hold, whatever else the file contains.
 */
export const STAMP_DIRECTORY = "data/build/.stamps";

/** The stages that add to the atlas cache after the base database is built. */
export const CACHE_STAGES = [
	"place-index",
	"area-search-index",
	"postcode-counts",
	"atlas-cache-stamp",
] as const;

export const stageStampPath = (root: string, stage: string) =>
	join(root, STAMP_DIRECTORY, `${stage}.json`);

/** Writes the stamp in one step, so a reader never sees half of it. */
export function writeStageStamp(
	root: string,
	stage: string,
	value: Record<string, string>,
) {
	const path = stageStampPath(root, stage);
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		writeFileSync(temporary, `${JSON.stringify(value)}\n`);
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	return path;
}

/** Drops stamps whose tables may no longer be in the shared file. */
export function removeStageStamps(root: string, stages: readonly string[]) {
	for (const stage of stages)
		rmSync(stageStampPath(root, stage), { force: true });
}

type Value = null | bigint | number | string | Uint8Array;

function hashValue(hash: ReturnType<typeof createHash>, value: Value) {
	if (value === null) hash.update("n;");
	else if (typeof value === "bigint") hash.update(`i${value};`);
	else if (typeof value === "number") hash.update(`r${value};`);
	else if (typeof value === "string")
		hash.update(`s${Buffer.byteLength(value)}:`)
			.update(value)
			.update(";");
	else hash.update(`b${value.byteLength}:`).update(value).update(";");
}

/**
 * A hash of what the named tables define and hold, and of the rows of the
 * shared `payloads` table with the named ids. It changes whenever a table's
 * schema or any value in it changes. Names come from the stage, never input.
 */
export function hashSqliteContent(
	database: DatabaseSync,
	tables: readonly string[],
	payloads: readonly string[] = [],
) {
	const hash = createHash("sha256");
	const rows = (sql: string, ...parameters: string[]) => {
		const statement = database.prepare(sql);
		statement.setReadBigInts(true);
		return statement.iterate(...parameters) as Iterable<
			Record<string, Value>
		>;
	};
	for (const name of [...tables].sort()) {
		const [schema] = [
			...rows(
				"SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
				name,
			),
		];
		hash.update(`table ${name}:`);
		hashValue(hash, schema?.sql ?? null);
		for (const row of rows(`SELECT * FROM "${name}"`))
			for (const value of Object.values(row)) hashValue(hash, value);
		hash.update("end;");
	}
	for (const id of [...payloads].sort()) {
		hash.update(`payload ${id}:`);
		for (const row of rows("SELECT payload FROM payloads WHERE id = ?", id))
			hashValue(hash, row.payload);
	}
	return hash.digest("hex");
}
