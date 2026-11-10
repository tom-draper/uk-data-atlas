import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cacheGeneration, type CacheComponent } from "@uk-data-atlas/atlas-db";
import { hashFile } from "../lib/fileHashCache.ts";
import {
	latestAtlasCachePath,
	publishAtlasCacheWork,
} from "./atlasCacheWriter.ts";
import { removeStageStamps, writeStageStamp } from "./stageStamp.ts";

// The components the stages before this one leave in the cache.
const STAGED_COMPONENTS: ReadonlyArray<readonly [string, CacheComponent]> = [
	["place-index", "place-index"],
	["area-search-index", "area-search"],
	["postcode-counts", "postcode-counts"],
];

/**
 * Throws unless the cache holds each stage's component for the canonical
 * database as it is now. A stage skipped as unchanged is only trusted while
 * this holds, and so is one whose tables were in a working copy that was lost.
 * A failing stage loses its stamp, so the next build reruns it. Checks the
 * working copy when the build has one, as that is what will be published.
 */
export function checkStagedComponents(root: string) {
	const cache = new DatabaseSync(latestAtlasCachePath(root), {
		readOnly: true,
	});
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

/**
 * Stamps the cache with the content hash of the canonical database and, if
 * the build kept a working copy of the cache, publishes it: the one vacuum and
 * the one rename of the build. Without a working copy it stamps the published
 * cache where it is.
 */
export function stampAtlasCache(root: string) {
	const canonical = resolve(root, "data/build/atlas.sqlite");
	const hash = hashFile(canonical);
	const cache = new DatabaseSync(latestAtlasCachePath(root), {
		readOnly: false,
	});
	try {
		cache
			.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)")
			.run("atlas-sqlite-content-hash", hash);
	} finally {
		cache.close();
	}
	if (hashFile(canonical) !== hash)
		throw new Error("atlas.sqlite changed while stamping its cache");
	publishAtlasCacheWork(root);
	writeStageStamp(root, "atlas-cache-stamp", {
		"atlas-sqlite-content-hash": hash,
	});
	return hash;
}
