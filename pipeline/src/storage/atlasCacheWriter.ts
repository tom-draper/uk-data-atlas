import { randomUUID } from "node:crypto";
import {
	constants,
	copyFileSync,
	existsSync,
	mkdirSync,
	renameSync,
	rmSync,
} from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { writeSqliteTables, type SqliteTable } from "@uk-data-atlas/artifacts";
import {
	atlasCachePartPath,
	atlasCachePath,
	CACHE_VERSION,
	cacheGeneration,
	closeReadOnlyDatabase,
	type CacheComponent,
} from "@uk-data-atlas/atlas-db";
import { atlasCacheWorkPath } from "./atlasCacheWork.ts";
import { publishVacuumed } from "./publishVacuumed.ts";

const CACHE_VERSION_KEY = "cacheVersion";

/**
 * Copy the published cache to the file a build changes, unless an older
 * compiler wrote it. Its tables and views may not match the current names, so
 * the build starts from an empty file and every component is rebuilt.
 */
function copyCurrentCache(source: string, destination: string) {
	if (!existsSync(source)) return;
	let current = false;
	try {
		const database = new DatabaseSync(source, { readOnly: true });
		try {
			current =
				database
					.prepare("SELECT value FROM meta WHERE key = ?")
					.get(CACHE_VERSION_KEY)?.value === String(CACHE_VERSION);
		} finally {
			database.close();
		}
	} catch {
		// Not a cache this compiler wrote.
	}
	if (current) copyFileSync(source, destination, constants.COPYFILE_FICLONE);
}

/** The tables every cache file holds, whichever components are in it. */
const SHARED_TABLES_DDL =
	"CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID; CREATE TABLE IF NOT EXISTS payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID; CREATE TABLE IF NOT EXISTS cache_generation (component TEXT PRIMARY KEY, generation TEXT NOT NULL) WITHOUT ROWID;";

export type CacheStep = {
	component: CacheComponent;
	write: (database: DatabaseSync) => void;
};

function applyStep(
	database: DatabaseSync,
	root: string,
	{ component, write }: CacheStep,
) {
	const generation = cacheGeneration(root, component);
	database.exec(`BEGIN; ${SHARED_TABLES_DDL}`);
	database
		.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)")
		.run(CACHE_VERSION_KEY, String(CACHE_VERSION));
	write(database);
	database
		.prepare("INSERT OR REPLACE INTO cache_generation VALUES (?, ?)")
		.run(component, generation);
	database.exec("COMMIT");
	return generation;
}

const guardGeneration = (
	root: string,
	component: CacheComponent,
	generation: string,
) => {
	if (cacheGeneration(root, component) !== generation)
		throw new Error(
			"Canonical cache inputs changed during compilation. Retry the cache build.",
		);
};

const FAST_WRITES = "PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;";

/**
 * Write one component to the file only its stage owns, in `atlas-cache-parts`.
 * The part is built beside its place and renamed, so a reader sees the old
 * file or the whole new one. Nothing else is read or kept from an earlier
 * build, so the part holds exactly what the stage just wrote.
 */
export function writeCachePart(root: string, step: CacheStep) {
	const path = atlasCachePartPath(root, step.component);
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		const database = new DatabaseSync(temporary);
		let generation: string;
		try {
			database.exec(FAST_WRITES);
			generation = applyStep(database, root, step);
		} finally {
			database.close();
		}
		guardGeneration(root, step.component, generation);
		// Readers in this process must not keep the file about to be replaced.
		closeReadOnlyDatabase(path);
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	return path;
}

/** The tables of a component's part, with their tables replaced as one write. */
export function writeCacheTables(
	root: string,
	component: CacheComponent,
	tables: Record<string, SqliteTable>,
) {
	return writeCachePart(root, {
		component,
		write: (database) => writeSqliteTables(database, tables),
	});
}

/** Tables every part holds, whose rows are merged rather than copied whole. */
const SHARED_TABLES = ["meta", "payloads", "cache_generation"];

/**
 * Copy a part into a cache file: its tables are created as the part defines
 * them and filled in the order the part holds them, and its rows of the
 * tables every part shares are added to the shared ones. A table the cache
 * already has under that name is replaced.
 */
export function copyCachePart(database: DatabaseSync, partPath: string) {
	database.prepare("ATTACH DATABASE ? AS part").run(partPath);
	try {
		database.exec(SHARED_TABLES_DDL);
		const schema = database
			.prepare(
				"SELECT type, name, sql FROM part.sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY rowid",
			)
			.all() as Array<{ type: string; name: string; sql: string }>;
		database.exec("BEGIN");
		try {
			copyPartRows(database, schema);
			database.exec("COMMIT");
		} catch (error) {
			database.exec("ROLLBACK");
			throw error;
		}
	} finally {
		database.exec("DETACH DATABASE part");
	}
}

function copyPartRows(
	database: DatabaseSync,
	schema: Array<{ type: string; name: string; sql: string }>,
) {
	for (const { type, name, sql } of schema)
		if (type === "table" && !SHARED_TABLES.includes(name)) {
			database.exec(`DROP TABLE IF EXISTS main."${name}"`);
			database.exec(sql);
			database.exec(
				`INSERT INTO main."${name}" SELECT * FROM part."${name}"`,
			);
		}
	for (const { type, sql } of schema)
		if (type !== "table") database.exec(sql);
	for (const name of SHARED_TABLES)
		database.exec(
			`INSERT OR REPLACE INTO main."${name}" SELECT * FROM part."${name}"`,
		);
}

/**
 * The working copy, made from the published cache if the build has none yet.
 */
export function ensureWorkingCopy(root: string) {
	const work = atlasCacheWorkPath(root);
	if (!existsSync(work)) copyCurrentCache(atlasCachePath(root), work);
	return work;
}

/**
 * Add components to the cache without exposing incomplete tables to API
 * readers: copy the cache once, apply every step to the copy, then publish it
 * with one `VACUUM INTO` and a rename. `vacuum: false` renames the copy as it
 * is and leaves the vacuum to a later publish.
 */
export function publishAtlasCacheSteps(
	root: string,
	steps: readonly CacheStep[],
	{ vacuum = true }: { vacuum?: boolean } = {},
) {
	const path = atlasCachePath(root);
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		copyCurrentCache(path, temporary);
		const database = new DatabaseSync(temporary);
		const generations = new Map<CacheComponent, string>();
		try {
			database.exec(FAST_WRITES);
			for (const step of steps)
				generations.set(
					step.component,
					applyStep(database, root, step),
				);
		} finally {
			database.close();
		}
		for (const [component, generation] of generations)
			guardGeneration(root, component, generation);
		// Readers in this process must not keep the file about to be replaced.
		if (vacuum)
			publishVacuumed(temporary, path, {
				atlasIdentity: false,
				beforeReplace: () => closeReadOnlyDatabase(path),
			});
		else {
			closeReadOnlyDatabase(path);
			renameSync(temporary, path);
		}
	} finally {
		rmSync(temporary, { force: true });
	}
	return path;
}

/** Replace one component without exposing incomplete tables to API readers. */
export function publishAtlasCache(
	root: string,
	component: CacheComponent,
	write: (database: DatabaseSync) => void,
) {
	return publishAtlasCacheSteps(root, [{ component, write }]);
}

/**
 * Publish the working copy over the cache: one `VACUUM INTO` beside the cache
 * and a rename. The working copy is removed afterwards, and survives a
 * failure. Returns false when there is no working copy.
 */
export function publishAtlasCacheWork(root: string) {
	const work = atlasCacheWorkPath(root);
	if (!existsSync(work)) return false;
	const path = atlasCachePath(root);
	publishVacuumed(work, path, {
		atlasIdentity: false,
		// Readers in this process must not keep the file about to be replaced.
		beforeReplace: () => closeReadOnlyDatabase(path),
	});
	rmSync(work, { force: true });
	return true;
}

export function publishCacheTables(
	root: string,
	component: CacheComponent,
	tables: Record<string, SqliteTable>,
) {
	return publishAtlasCache(root, component, (database) => {
		for (const name of Object.keys(tables))
			database.exec(`DROP TABLE IF EXISTS ${name}`);
		writeSqliteTables(database, tables);
	});
}
