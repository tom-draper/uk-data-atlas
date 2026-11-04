import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NAME_NORMALISATION } from "@uk-data-atlas/search-index/node";
import { openReadOnlyDatabase } from "./readOnlyDatabase.ts";

export type CacheComponent =
	| "area-search"
	| "place-index"
	| "projections"
	| "postcode-counts"
	| "datasets";

const CACHE_VERSION = 2;
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

/**
 * The semantic generation of the canonical inputs used by one compiler. Always
 * reads the file as it is now, so a writer can tell whether it changed.
 */
export function cacheGeneration(
	root: string,
	component: CacheComponent,
): string {
	const database = openReadOnlyDatabase(
		join(root, "data/build/atlas.sqlite"),
		{ fresh: true },
	);
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
		database.release();
	}
}

/**
 * Components whose stored generation matched the canonical inputs, with the
 * generations of the two files it was checked against. Replacing either file
 * changes the stamp, so the next read checks again before serving.
 */
const verified = new Map<string, string>();

export function requireAtlasCache(
	root: string,
	component: CacheComponent,
): string {
	const path = atlasCachePath(root);
	try {
		const canonical = openReadOnlyDatabase(
			join(root, "data/build/atlas.sqlite"),
		);
		const database = openReadOnlyDatabase(path);
		try {
			const key = `${path}:${component}`;
			const stamp = `${canonical.generation}:${database.generation}`;
			if (verified.get(key) !== stamp) {
				verified.delete(key);
				const stored = database
					.prepare(
						"SELECT generation FROM cache_generations WHERE component = ?",
					)
					.get(component)?.generation;
				if (stored !== cacheGeneration(root, component))
					throw new Error(`Stale ${component} generation`);
				verified.set(key, stamp);
			}
		} finally {
			database.release();
			canonical.release();
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
