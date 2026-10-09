import type { BoundaryGeojson } from "@lib/types";
import type { BoundaryType } from "./catalog";
import { decodeBoundaryData } from "./decode";
import {
	regionChunksForLocation,
	type RegionChunkKey,
} from "../datasetRegionChunks";

/**
 * The boundary families whose releases are also served cut into region chunks.
 * They are the ones large enough for a location view to feel the whole file
 * (a ward release is 7 MB, an LSOA one 15 MB) and whose location filter works
 * through a local authority, which is what a region chunk is keyed by.
 */
export const BOUNDARY_CHUNK_TYPES = [
	"ward",
	"lsoa",
] as const satisfies readonly BoundaryType[];

export type ChunkedBoundaryType = (typeof BOUNDARY_CHUNK_TYPES)[number];

/** Locations that filter by code prefix, and so read the whole release. */
export const COUNTRY_LOCATIONS: ReadonlySet<string> = new Set([
	"England",
	"Scotland",
	"Wales",
	"Northern Ireland",
	"United Kingdom",
]);

export const isChunkedBoundaryType = (
	type: BoundaryType | undefined,
): type is ChunkedBoundaryType =>
	type !== undefined &&
	(BOUNDARY_CHUNK_TYPES as readonly string[]).includes(type);

/** Where a release's chunk for one region is served, beside the release. */
export const boundaryChunkUrl = (asset: string, region: string) =>
	asset.replace("/boundaries.topojson", `/chunks/${region}.topojson`);

/**
 * The region chunks that hold every feature a named location can contain, or
 * null when the whole release is the right thing to read: another family, no
 * location, a whole country, or a location whose regions are not known.
 *
 * An LSOA location is cut to its local authorities by a lookup file. Without
 * it the filter falls back to a coarse bounding box, which a region's chunks
 * would not cover, so `hasLsoaLookup` must say the lookup is in hand.
 */
export const boundaryChunkRegions = (
	type: BoundaryType | undefined,
	location: string | null | undefined,
	hasLsoaLookup: boolean,
): readonly RegionChunkKey[] | null => {
	if (!isChunkedBoundaryType(type) || !location) return null;
	if (COUNTRY_LOCATIONS.has(location)) return null;
	if (type === "lsoa" && !hasLsoaLookup) return null;
	return regionChunksForLocation(location);
};

/**
 * Joins region chunks back into one collection, in the order the whole release
 * lists its features. Each chunk keeps its features' ids from the release, so
 * the map's hover state and the ordering both survive the split.
 */
export const mergeBoundaryChunks = (
	chunks: readonly BoundaryGeojson[],
): BoundaryGeojson => {
	const [first] = chunks;
	if (!first) throw new Error("No boundary chunks to merge");
	return {
		...first,
		features: chunks
			.flatMap((chunk) => chunk.features)
			.sort((left, right) => Number(left.id) - Number(right.id)),
	};
};

const fetchDecoded = async (url: string) => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${response.status} ${response.statusText}`,
		);
	}
	return decodeBoundaryData(await response.json());
};

/**
 * A release's features for a location. Reads only the given region chunks when
 * there are any and they can all be fetched; otherwise reads the whole release,
 * so a missing chunk costs the saving but never the map.
 */
export const fetchBoundaryGeometry = async (
	asset: string,
	regions: readonly RegionChunkKey[] | null,
): Promise<BoundaryGeojson> => {
	if (regions && regions.length > 0) {
		try {
			return mergeBoundaryChunks(
				await Promise.all(
					regions.map((region) =>
						fetchDecoded(boundaryChunkUrl(asset, region)),
					),
				),
			);
		} catch {
			// Fall through to the whole release.
		}
	}
	return fetchDecoded(asset);
};
