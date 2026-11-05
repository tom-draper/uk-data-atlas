import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, renameSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { writeSqliteTables, type SqliteTable } from "@uk-data-atlas/artifacts";
import {
	atlasCachePath,
	cacheGeneration,
	closeReadOnlyDatabase,
	type CacheComponent,
} from "@uk-data-atlas/atlas-runtime/storage";
import { removeDeprecatedObject } from "./deprecatedViews.ts";
import { hashSqliteContent, writeStageStamp } from "./stageStamp.ts";

/** Replace one component without exposing incomplete tables to API readers. */
export function publishAtlasCache(
	root: string,
	component: CacheComponent,
	write: (database: DatabaseSync) => void,
) {
	const generation = cacheGeneration(root, component);
	const path = atlasCachePath(root);
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		if (existsSync(path)) copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database.exec(
				"PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN; CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID; CREATE TABLE IF NOT EXISTS payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID; CREATE TABLE IF NOT EXISTS cache_generations (component TEXT PRIMARY KEY, generation TEXT NOT NULL) WITHOUT ROWID;",
			);
			write(database);
			database
				.prepare(
					"INSERT OR REPLACE INTO cache_generations VALUES (?, ?)",
				)
				.run(component, generation);
			database.exec("COMMIT; VACUUM");
		} finally {
			database.close();
		}
		if (cacheGeneration(root, component) !== generation)
			throw new Error(
				"Canonical cache inputs changed during compilation. Retry the cache build.",
			);
		// Readers in this process must not keep the file about to be replaced.
		closeReadOnlyDatabase(path);
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	return path;
}

export function publishCacheTables(
	root: string,
	component: CacheComponent,
	tables: Record<string, SqliteTable>,
) {
	return publishAtlasCache(root, component, (database) => {
		for (const [name, table] of Object.entries(tables)) {
			for (const oldName of Object.keys(table.views ?? {}))
				removeDeprecatedObject(database, oldName);
			database.exec(`DROP TABLE IF EXISTS ${name}`);
		}
		writeSqliteTables(database, tables);
	});
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
	const database = new DatabaseSync(atlasCachePath(root), { readOnly: true });
	try {
		const generation = database
			.prepare(
				"SELECT generation FROM cache_generations WHERE component = ?",
			)
			.get(stamp.component)?.generation;
		if (typeof generation !== "string")
			throw new Error(
				`The atlas cache has no ${stamp.component} generation`,
			);
		return writeStageStamp(root, stamp.stage, {
			component: stamp.component,
			generation,
			content: hashSqliteContent(database, stamp.tables, stamp.payloads),
		});
	} finally {
		database.close();
	}
}
