import { randomUUID } from "node:crypto";
import {
	constants,
	copyFileSync,
	existsSync,
	renameSync,
	rmSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { writeSqliteTables, type SqliteTable } from "@uk-data-atlas/artifacts";
import {
	atlasCachePath,
	CACHE_VERSION,
	cacheGeneration,
	closeReadOnlyDatabase,
	type CacheComponent,
} from "@uk-data-atlas/atlas-db";
import { CACHE_GENERATIONS_VIEW } from "./deprecatedViews.ts";
import {
	atlasCacheWorkPath,
	defersCachePublish,
	discardAtlasCacheWork,
	WORK_SESSION_KEY,
} from "./atlasCacheWork.ts";
import { publishVacuumed } from "./publishVacuumed.ts";
import { hashSqliteContent, writeStageStamp } from "./stageStamp.ts";

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

export type CacheStep = {
	component: CacheComponent;
	write: (database: DatabaseSync) => void;
};

function applyStep(
	database: DatabaseSync,
	root: string,
	{ component, write }: CacheStep,
	session?: string,
) {
	const generation = cacheGeneration(root, component);
	database.exec(
		"BEGIN; CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID; CREATE TABLE IF NOT EXISTS payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID; CREATE TABLE IF NOT EXISTS cache_generation (component TEXT PRIMARY KEY, generation TEXT NOT NULL) WITHOUT ROWID;",
	);
	database
		.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)")
		.run(CACHE_VERSION_KEY, String(CACHE_VERSION));
	if (session)
		database
			.prepare("INSERT OR IGNORE INTO meta VALUES (?, ?)")
			.run(WORK_SESSION_KEY, session);
	database.exec(
		`CREATE VIEW IF NOT EXISTS cache_generations AS ${CACHE_GENERATIONS_VIEW}`,
	);
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

/** The working copy if there is one, else the published cache. */
export const latestAtlasCachePath = (root: string) => {
	const work = atlasCacheWorkPath(root);
	return existsSync(work) ? work : atlasCachePath(root);
};

/**
 * The file a stage reads its own tables back from: the working copy while a
 * data build holds one, else the published cache.
 */
export const activeAtlasCachePath = (root: string) =>
	defersCachePublish() ? latestAtlasCachePath(root) : atlasCachePath(root);

/**
 * Add components to the cache without exposing incomplete tables to API
 * readers. Run by hand, this copies the cache once, applies every step to the
 * copy, then publishes it with one `VACUUM INTO` and a rename. Run by the data
 * build, the steps go into the shared working copy instead, which
 * `atlas-cache-stamp` publishes once for the whole build. `defer: false`
 * forces the first form, and `vacuum: false` renames the copy as it is and
 * leaves the vacuum to a later publish.
 */
export function publishAtlasCacheSteps(
	root: string,
	steps: readonly CacheStep[],
	{
		defer = defersCachePublish(),
		vacuum = true,
	}: { defer?: boolean; vacuum?: boolean } = {},
) {
	const path = atlasCachePath(root);
	if (defer) return writeToWorkingCopy(root, steps);
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

/**
 * Change the working copy in place, creating it from the published cache
 * first if this is the build's first write. A step that fails halfway leaves
 * pages that cannot be rolled back, so the copy goes with the stamps of the
 * stages that wrote to it, and the next stage starts again from the published
 * file. `atlas-cache-stamp` checks the stamps again before it publishes.
 */
function writeToWorkingCopy(root: string, steps: readonly CacheStep[]) {
	const work = atlasCacheWorkPath(root);
	const published = atlasCachePath(root);
	let session: string | undefined;
	try {
		if (!existsSync(work)) {
			session = randomUUID();
			copyCurrentCache(published, work);
		}
		const database = new DatabaseSync(work);
		const generations = new Map<CacheComponent, string>();
		try {
			database.exec(FAST_WRITES);
			session ??= (
				database
					.prepare("SELECT value FROM meta WHERE key = ?")
					.get(WORK_SESSION_KEY) as { value?: string } | undefined
			)?.value;
			for (const step of steps)
				generations.set(
					step.component,
					applyStep(database, root, step, session),
				);
		} finally {
			database.close();
		}
		for (const [component, generation] of generations)
			guardGeneration(root, component, generation);
	} catch (error) {
		// With the stamps of the stages that wrote to it, so none outlives its tables.
		discardAtlasCacheWork(root);
		throw error;
	}
	return work;
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
 * Publish the working copy over the cache: the one vacuum of the build, as a
 * `VACUUM INTO` beside the cache and a rename. The working copy is removed
 * afterwards, and survives a failure with its stamps. Returns false when the
 * build wrote nothing to the cache.
 */
export function publishAtlasCacheWork(root: string) {
	const work = atlasCacheWorkPath(root);
	if (!existsSync(work)) return false;
	const path = atlasCachePath(root);
	publishVacuumed(work, path, {
		// The published copy drops the session id; the working copy keeps it,
		// so a failed publish is still discarded with its stamps.
		finish: (database) =>
			database
				.prepare("DELETE FROM meta WHERE key = ?")
				.run(WORK_SESSION_KEY),
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
		dropCacheTables(database, tables);
		writeSqliteTables(database, tables);
	});
}

/**
 * Drop the tables a stage is about to rebuild, with the compatibility views
 * over them, which `writeSqliteTables` creates again.
 */
export function dropCacheTables(
	database: DatabaseSync,
	tables: Record<string, { views?: Record<string, string> }>,
) {
	for (const [name, table] of Object.entries(tables)) {
		for (const view of Object.keys(table.views ?? {}))
			database.exec(`DROP VIEW IF EXISTS ${view}`);
		database.exec(`DROP TABLE IF EXISTS ${name}`);
	}
}

/**
 * Records what a stage owns in the shared cache, once it is in place: the
 * component's generation and a hash of the stage's tables. The data build
 * tracks this stamp as the stage's output, so its digest follows the tables.
 */
export function stampCacheStage(
	root: string,
	stamp: {
		stage: string;
		component: CacheComponent;
		tables: readonly string[];
		payloads?: readonly string[];
	},
) {
	const database = new DatabaseSync(activeAtlasCachePath(root), {
		readOnly: true,
	});
	try {
		const generation = database
			.prepare(
				"SELECT generation FROM cache_generation WHERE component = ?",
			)
			.get(stamp.component)?.generation;
		if (typeof generation !== "string")
			throw new Error(
				`The atlas cache has no ${stamp.component} generation`,
			);
		// A stage that ran in a working copy carries its id, so its stamp is new
		// even when its tables are not. The stamp stage that publishes the copy
		// then runs in every build that made one.
		const session = database
			.prepare("SELECT value FROM meta WHERE key = ?")
			.get(WORK_SESSION_KEY)?.value;
		return writeStageStamp(root, stamp.stage, {
			component: stamp.component,
			generation,
			content: hashSqliteContent(database, stamp.tables, stamp.payloads),
			...(typeof session === "string" ? { session } : {}),
		});
	} finally {
		database.close();
	}
}
