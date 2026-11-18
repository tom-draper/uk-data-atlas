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
	publishAtlasCacheWork,
} from "./atlasCacheWriter.ts";
import { writeStageStamp } from "./stageStamp.ts";

// The components that stages write to a file of their own, to copy in.
const PART_COMPONENTS: readonly CacheComponent[] = [
	"place-index",
	"area-search",
	"postcode-counts",
];

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
 * Throws unless each stage's part holds its component for the canonical
 * database as it is now. A stage skipped as unchanged is only trusted while
 * this holds, and so is one whose part was deleted or built for older inputs.
 */
export function checkStagedComponents(root: string) {
	for (const component of PART_COMPONENTS) checkPart(root, component);
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
