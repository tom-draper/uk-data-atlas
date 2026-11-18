import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
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
import { hashFile } from "../lib/fileHashCache.ts";
import { publishVacuumed } from "./publishVacuumed.ts";

const CACHE_VERSION_KEY = "cacheVersion";

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
	canonical?: string,
) {
	const generation = cacheGeneration(root, component, canonical);
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
	canonical?: string,
) => {
	if (cacheGeneration(root, component, canonical) !== generation)
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
export function writeCachePart(
	root: string,
	step: CacheStep,
	{ canonical }: { canonical?: string } = {},
) {
	const path = atlasCachePartPath(root, step.component);
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		const database = new DatabaseSync(temporary);
		let generation: string;
		try {
			database.exec(FAST_WRITES);
			generation = applyStep(database, root, step, canonical);
		} finally {
			database.close();
		}
		guardGeneration(root, step.component, generation, canonical);
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
 * The components of the cache, in the order they are assembled. Each is built
 * by a stage that keeps it in a part of its own.
 */
export const CACHE_COMPONENTS: readonly CacheComponent[] = [
	"projections",
	"datasets",
	"place-index",
	"area-search",
	"postcode-counts",
];

/**
 * The part holds its component for the canonical database as it is now, or
 * this throws. A stage skipped as unchanged is only trusted while that holds,
 * and so is one whose part was deleted or built for older inputs.
 */
export function checkCachePart(root: string, component: CacheComponent) {
	const path = atlasCachePartPath(root, component);
	let stored: unknown;
	try {
		const part = new DatabaseSync(path, { readOnly: true });
		try {
			stored = part
				.prepare(
					"SELECT generation FROM cache_generation WHERE component = ?",
				)
				.get(component)?.generation;
		} finally {
			part.close();
		}
	} catch {
		// A missing or unreadable part has no generation.
	}
	if (stored !== cacheGeneration(root, component))
		throw new Error(
			`There are no current ${component} tables in ${path}. Run the data build again to rebuild them.`,
		);
}

/**
 * Assemble `atlas-cache.sqlite` from the parts of the stages that built each
 * component, and stamp it with the content hash of the canonical database it
 * was built for. The file is written whole beside the cache, vacuumed into
 * place and renamed, so a reader sees the old cache or the new one. Nothing
 * of an earlier cache is kept: every component comes from its part.
 * Returns the hash.
 */
export function assembleAtlasCache(
	root: string,
	components: readonly CacheComponent[] = CACHE_COMPONENTS,
) {
	for (const component of components) checkCachePart(root, component);
	const canonical = join(root, "data/build/atlas.sqlite");
	const hash = hashFile(canonical);
	const path = atlasCachePath(root);
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		const database = new DatabaseSync(temporary);
		try {
			database.exec(FAST_WRITES);
			database.exec(SHARED_TABLES_DDL);
			database
				.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)")
				.run(CACHE_VERSION_KEY, String(CACHE_VERSION));
			for (const component of components)
				copyCachePart(database, atlasCachePartPath(root, component));
			database
				.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)")
				.run("atlas-sqlite-content-hash", hash);
		} finally {
			database.close();
		}
		if (hashFile(canonical) !== hash)
			throw new Error("atlas.sqlite changed while its cache was built");
		publishVacuumed(temporary, path, {
			atlasIdentity: false,
			// Readers in this process must not keep the file about to be replaced.
			beforeReplace: () => closeReadOnlyDatabase(path),
		});
	} finally {
		rmSync(temporary, { force: true });
	}
	return hash;
}

/**
 * Write one component's tables to its part and assemble the cache from the
 * parts there are. For fixtures that need a cache holding some components.
 */
export function publishCacheTables(
	root: string,
	component: CacheComponent,
	tables: Record<string, SqliteTable>,
) {
	writeCacheTables(root, component, tables);
	assembleAtlasCache(
		root,
		CACHE_COMPONENTS.filter((name) =>
			existsSync(atlasCachePartPath(root, name)),
		),
	);
	return atlasCachePath(root);
}
