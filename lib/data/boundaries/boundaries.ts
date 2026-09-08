// lib/data/boundaries.ts
import { BoundaryGeojson } from "@lib/types";
import { decodeBoundaryData } from "./decode";
import { fetchBoundaryInWorker } from "./worker";
import type { Crosswalk } from "../gazetteer/types";
import type { BoundaryType, BoundaryYear } from "./catalog";
import { filterFeatures } from "./filter";

export { BOUNDARY_CATALOG } from "./catalog";
export type { BoundaryType, BoundaryYear } from "./catalog";
export { getProp } from "./properties";
export { filterFeatures } from "./filter";

export type WardYear = BoundaryYear<"ward">;
export type ConstituencyYear = BoundaryYear<"constituency">;
export type LocalAuthorityYear = BoundaryYear<"localAuthority">;

/**
 * Decoded geometry, most recently used last.
 *
 * Only the selected location's geometry is returned from the worker, while
 * every chart aggregates from properties sidecars. The cache is therefore
 * keyed by both boundary release and location, rather than retaining complete
 * UK-wide coordinate sets just because the user visited a few map vintages.
 * Keeping a few selected results still makes moving back and forth a cache hit.
 */
const GEOMETRY_CACHE_LIMIT = 3;
const BOUNDARY_CACHE = new Map<string, BoundaryGeojson>();
const BOUNDARY_PENDING = new Map<string, Promise<BoundaryGeojson>>();

const rememberGeometry = (cacheKey: string, data: BoundaryGeojson) => {
	BOUNDARY_CACHE.delete(cacheKey);
	BOUNDARY_CACHE.set(cacheKey, data);
	if (BOUNDARY_CACHE.size > GEOMETRY_CACHE_LIMIT) {
		BOUNDARY_CACHE.delete(BOUNDARY_CACHE.keys().next().value!);
	}
};

/** Properties sidecars, held for every vintage: they are small and all needed. */
const PROPERTIES_CACHE = new Map<string, BoundaryGeojson>();
const PROPERTIES_PENDING = new Map<string, Promise<BoundaryGeojson>>();

type PropertiesFile = {
	release?: string;
	features?: Record<string, unknown>[];
};

/**
 * A sidecar read as a boundary collection whose features carry no geometry, so
 * that filtering and aggregation — which only ever read properties — take it
 * unchanged wherever they would take a decoded file.
 */
const decodeProperties = (json: unknown): BoundaryGeojson => {
	const records = (json as PropertiesFile)?.features;
	if (!Array.isArray(records)) {
		throw new Error("Properties file contains no features");
	}
	return {
		type: "FeatureCollection",
		crs: {
			type: "name",
			properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
		},
		features: records.map((properties, index) => ({
			type: "Feature" as const,
			id: index + 1,
			geometry: null,
			properties,
		})),
	} as unknown as BoundaryGeojson;
};

/** The properties of every feature in a release, without its coordinates. */
export function fetchBoundaryProperties(
	path: string,
): Promise<BoundaryGeojson> {
	const cached = PROPERTIES_CACHE.get(path);
	if (cached) return Promise.resolve(cached);
	const pending = PROPERTIES_PENDING.get(path);
	if (pending) return pending;

	const promise = fetch(path)
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(
					`Failed to fetch ${path}: ${response.status} ${response.statusText}`,
				);
			}
			return decodeProperties(await response.json());
		})
		.then((data) => {
			PROPERTIES_CACHE.set(path, data);
			PROPERTIES_PENDING.delete(path);
			return data;
		});
	PROPERTIES_PENDING.set(path, promise);
	promise.catch(() => PROPERTIES_PENDING.delete(path));
	return promise;
}
export type BoundaryGeometryFilter = {
	type: BoundaryType;
	location: string | null;
	getLadForWard?: (wardCode: string) => string | undefined;
	constituencyLadOverlaps?: Crosswalk;
};

export const geometryCacheKey = (
	path: string,
	filter?: BoundaryGeometryFilter,
) =>
	filter
		? `${path}\u0000${filter.type}\u0000${filter.location ?? ""}\u0000${filter.constituencyLadOverlaps ? "constituency-lad-overlaps" : "bbox"}`
		: path;

/**
 * Fetch and cache boundary file (supports both GeoJSON and TopoJSON)
 */
async function doFetchBoundaryFile(
	path: string,
	filter?: BoundaryGeometryFilter,
): Promise<BoundaryGeojson> {
	const res = await fetch(path);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch ${path}: ${res.status} ${res.statusText}`,
		);
	}

	const typedGeojson = decodeBoundaryData(await res.json());
	return filter
		? filterFeatures(
				typedGeojson,
				filter.location,
				filter.type,
				filter.getLadForWard,
				filter.constituencyLadOverlaps,
			)
		: typedGeojson;
}

export function fetchBoundaryFile(
	path: string,
	filter?: BoundaryGeometryFilter,
): Promise<BoundaryGeojson> {
	const cacheKey = geometryCacheKey(path, filter);
	const cached = BOUNDARY_CACHE.get(cacheKey);
	if (cached) {
		rememberGeometry(cacheKey, cached);
		return Promise.resolve(cached);
	}
	const pending = BOUNDARY_PENDING.get(cacheKey);
	if (pending) return pending;

	const workerFetch = fetchBoundaryInWorker(path, filter);
	const promise = (
		workerFetch
			? workerFetch.catch(() => doFetchBoundaryFile(path, filter))
			: doFetchBoundaryFile(path, filter)
	).then((data) => {
		rememberGeometry(cacheKey, data);
		BOUNDARY_PENDING.delete(cacheKey);
		return data;
	});
	BOUNDARY_PENDING.set(cacheKey, promise);
	promise.catch(() => {
		BOUNDARY_PENDING.delete(cacheKey);
	});
	return promise;
}
