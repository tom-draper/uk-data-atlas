import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NAME_NORMALISATION } from "./search/node/index.ts";
import { openReadOnlyDatabase } from "./readOnlyDatabase.ts";
import { openBuildMetadata, readBuildPayload } from "./buildMetadata.ts";

export type CacheComponent =
	| "area-search"
	| "place-index"
	| "projections"
	| "postcode-counts"
	| "datasets";

/**
 * The cache compiler's version. It is part of every generation, so readers
 * reject a cache built under another version, and the pipeline starts a cache
 * stored under another version from an empty file.
 */
export const CACHE_VERSION = 4;
/**
 * What each component is built from. `build:` runs on the database's build
 * metadata file, and `payload:` reads a payload document there.
 */
const dependencies: Record<CacheComponent, string[]> = {
	"area-search": ["build:SELECT content_hash FROM area_inventory_metadata"],
	"place-index": [
		"build:SELECT content_hash FROM area_inventory_metadata",
		"build:SELECT content_hash FROM named_location_inventory_metadata",
		"payload:boundary-releases",
	],
	projections: [
		"build:SELECT content_hash FROM area_inventory_metadata",
		"build:SELECT content_hash FROM named_location_inventory_metadata",
		"build:SELECT content_hash FROM crosswalk_inventory_metadata",
	],
	"postcode-counts": ["payload:postcode-index", "payload:postcode-areas"],
	datasets: [
		"build:SELECT slug, compiled_sha256 FROM dataset_build WHERE compiled_type IS NOT NULL ORDER BY slug",
	],
};

export const atlasCachePath = (root: string) =>
	join(root, "data/build/atlas-cache.sqlite");

/**
 * Where the stage that builds a component leaves it, before `assemble-cache`
 * puts every component into `atlas-cache.sqlite`. Each file has one writer and
 * holds the component's tables, its `payloads` rows and its generation. A
 * release carries only the assembled cache, so these exist in a build tree.
 */
export const atlasCachePartPath = (root: string, component: CacheComponent) =>
	join(root, "data/build/atlas-cache-parts", `${component}.sqlite`);

/**
 * The semantic generation of the canonical inputs used by one compiler. Always
 * reads the file as it is now, so a writer can tell whether it changed. The
 * base build reads `atlas-base.sqlite`, which holds its inputs before
 * `atlas.sqlite` exists.
 */
export function cacheGeneration(
	root: string,
	component: CacheComponent,
	canonicalPath = join(root, "data/build/atlas.sqlite"),
): string {
	const build = openBuildMetadata(canonicalPath, { fresh: true });
	try {
		const inputs = dependencies[component].map((dependency) => {
			if (dependency.startsWith("build:"))
				return build
					.prepare(dependency.slice(6))
					.all()
					.map((row) => Object.values(row));
			if (dependency.startsWith("payload:"))
				return (
					readBuildPayload(canonicalPath, dependency.slice(8), {
						fresh: true,
					}) ?? null
				);
			throw new Error(`Unknown cache dependency ${dependency}`);
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
		build.release();
	}
}

/**
 * The file to read a component's rows from when the reader checks each row
 * against `atlas.sqlite` itself: the stage's own part while a build tree has
 * one, else the assembled cache.
 */
export const atlasCacheFile = (root: string, component: CacheComponent) => {
	const part = atlasCachePartPath(root, component);
	return existsSync(part) ? part : atlasCachePath(root);
};

/**
 * Components whose stored generation matched the canonical inputs, with the
 * generations of the two files it was checked against. Replacing either file
 * changes the stamp, so the next read checks again before serving.
 */
const verified = new Map<string, string>();

/**
 * The file that holds a component built from the current `atlas.sqlite`: the
 * stage's own part while a build tree has one, else the assembled cache. A
 * stage that reads a component right after the stage that wrote it therefore
 * does not wait for the assembly, and a deployment with only the cache reads
 * the cache. A file with another generation is passed over.
 */
export function requireAtlasCache(
	root: string,
	component: CacheComponent,
): string {
	const path = atlasCachePath(root);
	const candidates = [atlasCachePartPath(root, component), path].filter(
		(candidate) => existsSync(candidate),
	);
	let failure: unknown = new Error("No atlas cache file");
	for (const candidate of candidates) {
		try {
			const canonical = openReadOnlyDatabase(
				join(root, "data/build/atlas.sqlite"),
			);
			const canonicalBuild = openBuildMetadata(
				join(root, "data/build/atlas.sqlite"),
			);
			const database = openReadOnlyDatabase(candidate);
			try {
				const key = `${candidate}:${component}`;
				const stamp = `${canonical.generation}:${canonicalBuild.generation}:${database.generation}`;
				if (verified.get(key) !== stamp) {
					verified.delete(key);
					const stored = database
						.prepare(
							"SELECT generation FROM cache_generation WHERE component = ?",
						)
						.get(component)?.generation;
					if (stored !== cacheGeneration(root, component))
						throw new Error(`Stale ${component} generation`);
					verified.set(key, stamp);
				}
			} finally {
				database.release();
				canonicalBuild.release();
				canonical.release();
			}
			return candidate;
		} catch (cause) {
			failure = cause;
		}
	}
	throw new Error(
		`Missing or stale ${component} cache at ${path}. Download the matching atlas data release.`,
		{ cause: failure },
	);
}

export function readCachePayload(
	root: string,
	component: CacheComponent,
	id: string,
): string {
	const database = openReadOnlyDatabase(requireAtlasCache(root, component));
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
		database.release();
	}
}
