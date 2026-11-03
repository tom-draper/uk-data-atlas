import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NAME_NORMALISATION } from "@uk-data-atlas/search-index/node";

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

export function requireAtlasCache(
	root: string,
	component: CacheComponent,
): string {
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
	root: string,
	component: CacheComponent,
	id: string,
): string {
	const database = new DatabaseSync(requireAtlasCache(root, component), {
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
