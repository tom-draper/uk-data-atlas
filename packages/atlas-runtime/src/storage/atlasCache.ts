import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NAME_NORMALISATION } from "@uk-data-atlas/search-index/node";
import { writeSqliteTables, type SqliteTable } from "@uk-data-atlas/artifacts";
import { repositoryRootOf } from "./dataLayout";

export type CacheComponent =
	| "area-search"
	| "place-index"
	| "projections"
	| "postcode-counts"
	| "datasets";

const CACHE_VERSION = 1;
const dependencies: Record<CacheComponent, string[]> = {
	"area-search": ["area_inventory"],
	"place-index": [
		"area_inventory",
		"named_location_inventory",
		"payload:boundary-releases",
	],
	projections: [
		"area_inventory",
		"named_location_inventory",
		"crosswalk_inventory",
	],
	"postcode-counts": ["payload:postcode-index", "payload:postcode-areas"],
	datasets: ["query:SELECT output, sha256 FROM datasets ORDER BY output"],
};

export const atlasCachePath = (root: string) =>
	join(root, "data/build/atlas-cache.sqlite");

/** The semantic generation of the canonical inputs used by one compiler. */
export function cacheGeneration(
	root: string,
	component: CacheComponent,
): string {
	const database = new DatabaseSync(join(root, "data/build/atlas.sqlite"), {
		readOnly: true,
	});
	try {
		const inputs = dependencies[component].map((dependency) => {
			if (dependency.startsWith("query:"))
				return database
					.prepare(dependency.slice(6))
					.all()
					.map((row) => Object.values(row));
			if (dependency.startsWith("payload:"))
				return (
					database
						.prepare("SELECT payload FROM payloads WHERE id = ?")
						.get(dependency.slice(8))?.payload ?? null
				);
			return (
				database.prepare(`SELECT contentHash FROM ${dependency}`).get()
					?.contentHash ?? null
			);
		});
		return createHash("sha256")
			.update(
				JSON.stringify({
					version: CACHE_VERSION,
					component,
					nameNormalisation: NAME_NORMALISATION,
					inputs,
				}),
			)
			.digest("hex");
	} finally {
		database.close();
	}
}

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
		for (const name of Object.keys(tables))
			database.exec(`DROP TABLE IF EXISTS ${name}`);
		writeSqliteTables(database, tables);
	});
}

export function requireAtlasCache(
	apiRoot: string,
	component: CacheComponent,
): string {
	const root = repositoryRootOf(apiRoot);
	const path = atlasCachePath(root);
	try {
		const database = new DatabaseSync(path, { readOnly: true });
		try {
			const stored = database
				.prepare(
					"SELECT generation FROM cache_generations WHERE component = ?",
				)
				.get(component)?.generation;
			if (stored !== cacheGeneration(root, component))
				throw new Error(`Stale ${component} generation`);
		} finally {
			database.close();
		}
	} catch (cause) {
		throw new Error(
			`Missing or stale ${component} cache at ${path}. Download the matching atlas data release.`,
			{ cause },
		);
	}
	return path;
}

export function readCachePayload(
	apiRoot: string,
	component: CacheComponent,
	id: string,
): string {
	const database = new DatabaseSync(requireAtlasCache(apiRoot, component), {
		readOnly: true,
	});
	try {
		const row = database
			.prepare("SELECT payload FROM payloads WHERE id = ?")
			.get(id);
		if (typeof row?.payload !== "string")
			throw new Error(
				`Missing cache payload ${id}. Download the matching atlas data release.`,
			);
		return row.payload;
	} finally {
		database.close();
	}
}
