// lib/data/boundaries.ts
import { BoundaryGeojson } from "@lib/types";
import { gazetteer } from "@lib/data/gazetteer/static";
import { getProp } from "./properties";
import { decodeBoundaryData } from "./decode";
import { fetchBoundaryInWorker } from "./worker";
import { featureExtent } from "./derived";
import type { Crosswalk } from "../gazetteer/types";
import {
	BOUNDARY_CATALOG,
	type BoundaryType,
	type BoundaryYear,
} from "./catalog";

export { BOUNDARY_CATALOG } from "./catalog";
export type { BoundaryType, BoundaryYear } from "./catalog";
export { getProp } from "./properties";

export type WardYear = BoundaryYear<"ward">;
export type ConstituencyYear = BoundaryYear<"constituency">;
export type LocalAuthorityYear = BoundaryYear<"localAuthority">;

const COUNTRY_PREFIXES: Record<string, string> = {
	England: "E",
	Scotland: "S",
	Wales: "W",
	"Northern Ireland": "N",
};

/**
 * Decoded geometry, most recently used last.
 *
 * Only the vintage being drawn needs coordinates — every chart aggregates over
 * its own vintage by code alone, from the properties sidecar — so this holds a
 * few rather than every file a session touches. A UK ward vintage is around a
 * million coordinate pairs, so an unbounded cache is the difference between a
 * few hundred MB and several GB. Keeping more than one still makes moving back
 * and forth between two years a cache hit rather than a refetch.
 */
const GEOMETRY_CACHE_LIMIT = 3;
const BOUNDARY_CACHE = new Map<string, BoundaryGeojson>();
const BOUNDARY_PENDING: Partial<Record<string, Promise<BoundaryGeojson>>> = {};

const rememberGeometry = (path: string, data: BoundaryGeojson) => {
	BOUNDARY_CACHE.delete(path);
	BOUNDARY_CACHE.set(path, data);
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
/**
 * Fast AABB (Axis-Aligned Bounding Box) intersection check
 */
const isFeatureInBounds = (
	feature: BoundaryGeojson["features"][number],
	bounds: [number, number, number, number],
): boolean => {
	const [west, south, east, north] = bounds;
	// Properties sidecars omit coordinates, but carry the same compiled extent
	// that the geometry path would calculate. `featureExtent` uses it first and
	// falls back to a cached coordinate walk for full boundary files.
	const featureBounds = featureExtent(feature);

	return (
		featureBounds !== null &&
		featureBounds[0] <= east &&
		featureBounds[2] >= west &&
		featureBounds[1] <= north &&
		featureBounds[3] >= south
	);
};

/**
 * Get property keys for a given boundary type
 */
const getPropertyKeys = (type: BoundaryType) => {
	return BOUNDARY_CATALOG[type].properties;
};

/**
 * Fetch and cache boundary file (supports both GeoJSON and TopoJSON)
 */
async function doFetchBoundaryFile(path: string): Promise<BoundaryGeojson> {
	const res = await fetch(path);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch ${path}: ${res.status} ${res.statusText}`,
		);
	}

	const typedGeojson = decodeBoundaryData(await res.json());
	rememberGeometry(path, typedGeojson);
	delete BOUNDARY_PENDING[path];
	return typedGeojson;
}

export function fetchBoundaryFile(path: string): Promise<BoundaryGeojson> {
	const cached = BOUNDARY_CACHE.get(path);
	if (cached) {
		rememberGeometry(path, cached);
		return Promise.resolve(cached);
	}
	if (BOUNDARY_PENDING[path]) return BOUNDARY_PENDING[path]!;

	const workerFetch = fetchBoundaryInWorker(path);
	const promise = (
		workerFetch
			? workerFetch.catch(() => doFetchBoundaryFile(path))
			: doFetchBoundaryFile(path)
	).then((data) => {
		rememberGeometry(path, data);
		delete BOUNDARY_PENDING[path];
		return data;
	});
	BOUNDARY_PENDING[path] = promise;
	promise.catch(() => {
		delete BOUNDARY_PENDING[path];
	});
	return promise;
}

/**
 * Filter features by location
 * Pass getLadForWard from useWardLadMap to enable 2021 ward filtering
 */
export const filterFeatures = (
	geojson: BoundaryGeojson,
	location: string | null,
	type: BoundaryType,
	getLadForWard?: (wardCode: string) => string | undefined,
	constituencyLadOverlaps?: Crosswalk,
): BoundaryGeojson => {
	// No filtering needed for UK-wide view
	if (!location || location === "United Kingdom") {
		return geojson;
	}

	const { code: codeKeys } = getPropertyKeys(type);

	// Filter by country prefix (England, Scotland, Wales, Northern Ireland)
	if (COUNTRY_PREFIXES[location]) {
		const prefix = COUNTRY_PREFIXES[location];
		return {
			...geojson,
			features: geojson.features.filter((f) => {
				const code = getProp(f.properties, codeKeys);
				return code?.startsWith(prefix);
			}),
		};
	}

	const loc = gazetteer.namedLocation(location);
	if (!loc) {
		console.warn(`Location data not found for: ${location}`);
		return geojson;
	}

	// Filter wards by LAD code (uses getLadForWard for 2021 data without LAD properties)
	if (type === "ward" && loc.memberCodes?.length) {
		const ladCodeSet = new Set(loc.memberCodes);
		return {
			...geojson,
			features: geojson.features.filter((f) => {
				const wardCode = getProp(
					f.properties,
					BOUNDARY_CATALOG.ward.properties.code,
				);
				let ladCode = getProp(
					f.properties,
					BOUNDARY_CATALOG.ward.properties.parentCode ??
						BOUNDARY_CATALOG.localAuthority.properties.code,
				);
				const mappedLadCode =
					wardCode && getLadForWard
						? getLadForWard(wardCode)
						: undefined;
				ladCode = ladCode || mappedLadCode;
				return ladCode && ladCodeSet.has(ladCode);
			}),
		};
	}

	// Filter local authorities by LAD code
	if (type === "localAuthority" && loc.memberCodes?.length) {
		const ladCodeSet = new Set(loc.memberCodes);
		return {
			...geojson,
			features: geojson.features.filter((f) => {
				const ladCode = getProp(
					f.properties,
					BOUNDARY_CATALOG.localAuthority.properties.code,
				);
				return ladCode && ladCodeSet.has(ladCode);
			}),
		};
	}

	// Filter LSOAs by bounding box (no LAD code in simplified topojson)
	if (type === "lsoa" && loc.bbox) {
		return {
			...geojson,
			features: geojson.features.filter((f) =>
				isFeatureInBounds(f, loc.bbox!),
			),
		};
	}

	// Filter Data Zones by bounding box
	if (type === "dataZone" && loc.bbox) {
		return {
			...geojson,
			features: geojson.features.filter((f) =>
				isFeatureInBounds(f, loc.bbox!),
			),
		};
	}

	// Filter NI Super Output Areas by bounding box
	if (type === "superOutputArea" && loc.bbox) {
		return {
			...geojson,
			features: geojson.features.filter((f) =>
				isFeatureInBounds(f, loc.bbox!),
			),
		};
	}

	// Filter constituencies by bounding box
	if (
		type === "constituency" &&
		loc.memberCodes?.length &&
		constituencyLadOverlaps
	) {
		const ladCodeSet = new Set(loc.memberCodes);
		return {
			...geojson,
			features: geojson.features.filter((feature) => {
				const constituencyCode = getProp(feature.properties, codeKeys);
				return (
					constituencyLadOverlaps[constituencyCode ?? ""] ?? []
				).some(({ code }) => ladCodeSet.has(code));
			}),
		};
	}

	// A crosswalk is not needed for country-wide locations and remains an
	// optional progressive enhancement if its generated file cannot be served.
	// Bbox filtering preserves the previous fallback in those cases.
	if (type === "constituency" && loc.bbox) {
		return {
			...geojson,
			features: geojson.features.filter((f) =>
				isFeatureInBounds(f, loc.bbox!),
			),
		};
	}

	return geojson;
};
