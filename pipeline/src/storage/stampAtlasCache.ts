import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	atlasCachePartPath,
	cacheGeneration,
	type CacheComponent,
} from "@uk-data-atlas/atlas-db";
import { hashFile } from "../lib/fileHashCache.ts";
import {
	copyCachePart,
	ensureWorkingCopy,
	latestAtlasCachePath,
	publishAtlasCacheWork,
} from "./atlasCacheWriter.ts";
import { removeStageStamps, writeStageStamp } from "./stageStamp.ts";

// The components the stages before this one leave in the cache.
const STAGED_COMPONENTS: ReadonlyArray<readonly [string, CacheComponent]> = [
	["place-index", "place-index"],
	["area-search-index", "area-search"],
];

// The components that stages write to a file of their own, to copy in.
const PART_COMPONENTS: readonly CacheComponent[] = ["postcode-counts"];

function checkPart(root: string, component: CacheComponent) {
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
 * Throws unless the cache holds each stage's component for the canonical
 * database as it is now. A stage skipped as unchanged is only trusted while
 * this holds, and so is one whose tables were in a working copy that was lost.
 * A failing stage loses its stamp, so the next build reruns it. Checks the
 * working copy when the build has one, as that is what will be published.
 */
export function checkStagedComponents(root: string) {
	checkWorkingCopy(root);
	for (const component of PART_COMPONENTS) checkPart(root, component);
}

function checkWorkingCopy(root: string) {
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
	// The parts are copied into the working copy, so the cache is replaced once.
	const cache = new DatabaseSync(ensureWorkingCopy(root), {
		readOnly: false,
	});
	try {
		for (const component of PART_COMPONENTS)
			copyCachePart(cache, atlasCachePartPath(root, component));
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
