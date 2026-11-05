import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	atlasCachePath,
	buildLog,
	cacheGeneration,
	type CacheComponent,
} from "@uk-data-atlas/atlas-runtime/storage";
import { hashFile } from "./fileHashCache.ts";
import { removeStageStamps, writeStageStamp } from "./storage/stageStamp.ts";

// The components the stages before this one leave in the cache.
const STAGED_COMPONENTS: ReadonlyArray<readonly [string, CacheComponent]> = [
	["place-index", "place-index"],
	["area-search-index", "area-search"],
	["postcode-counts", "postcode-counts"],
];

/**
 * Throws unless the cache holds each stage's component for the canonical
 * database as it is now. A stage skipped as unchanged is only trusted while
 * this holds. A failing stage loses its stamp, so the next build reruns it.
 */
export function checkStagedComponents(root: string) {
	const cache = new DatabaseSync(atlasCachePath(root), { readOnly: true });
	try {
		for (const [stage, component] of STAGED_COMPONENTS) {
			const stored = cache
				.prepare(
					"SELECT generation FROM cache_generation WHERE component = ?",
				)
				.get(component)?.generation;
			if (stored !== cacheGeneration(root, component)) {
				removeStageStamps(root, [stage]);
				throw new Error(
					`The atlas cache has no current ${component} tables. Run the data build again to rebuild them.`,
				);
			}
		}
	} finally {
		cache.close();
	}
}

export function stampAtlasCache(root: string) {
	const canonical = resolve(root, "data/build/atlas.sqlite");
	const hash = hashFile(canonical);
	const cache = new DatabaseSync(atlasCachePath(root), { readOnly: false });
	try {
		cache
			.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)")
			.run("atlas-sqlite-content-hash", hash);
	} finally {
		cache.close();
	}
	if (hashFile(canonical) !== hash)
		throw new Error("atlas.sqlite changed while stamping its cache");
	writeStageStamp(root, "atlas-cache-stamp", {
		"atlas-sqlite-content-hash": hash,
	});
	return hash;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === resolve(import.meta.filename)
) {
	const root = resolve(import.meta.dirname, "../..");
	checkStagedComponents(root);
	buildLog.info(
		`Stamped the atlas cache with content hash ${stampAtlasCache(root)}`,
	);
}
