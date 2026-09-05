// lib/data/boundaries.ts
import { BoundaryGeojson } from "@lib/types";
import { gazetteer } from "@lib/data/gazetteer/static";
import { getProp } from "./properties";
import { decodeBoundaryData } from "./decode";
import { fetchBoundaryInWorker } from "./worker";
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

const BOUNDARY_CACHE: Record<string, BoundaryGeojson> = {};
const BOUNDARY_PENDING: Partial<Record<string, Promise<BoundaryGeojson>>> = {};
const featureBoundsCache = new WeakMap<
	object,
	[number, number, number, number] | null
>();

/**
 * Fast AABB (Axis-Aligned Bounding Box) intersection check
 */
const isFeatureInBounds = (
	feature: any,
	bounds: [number, number, number, number],
): boolean => {
	const [west, south, east, north] = bounds;
	let featureBounds = featureBoundsCache.get(feature);
	if (featureBounds === undefined) {
		if (!feature.geometry?.coordinates) {
			featureBounds = null;
		} else {
			const flatCoords =
				feature.geometry.type === "MultiPolygon"
					? feature.geometry.coordinates.flat(2)
					: feature.geometry.coordinates.flat(1);

			let minX = Infinity,
				minY = Infinity;
			let maxX = -Infinity,
				maxY = -Infinity;

			for (const [x, y] of flatCoords) {
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
			}
			featureBounds = [minX, minY, maxX, maxY];
		}
		featureBoundsCache.set(feature, featureBounds);
	}

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
	BOUNDARY_CACHE[path] = typedGeojson;
	delete BOUNDARY_PENDING[path];
	return typedGeojson;
}

export function fetchBoundaryFile(path: string): Promise<BoundaryGeojson> {
	if (BOUNDARY_CACHE[path]) return Promise.resolve(BOUNDARY_CACHE[path]);
	if (BOUNDARY_PENDING[path]) return BOUNDARY_PENDING[path]!;

	const workerFetch = fetchBoundaryInWorker(path);
	const promise = (
		workerFetch
			? workerFetch.catch(() => doFetchBoundaryFile(path))
			: doFetchBoundaryFile(path)
	).then((data) => {
		BOUNDARY_CACHE[path] = data;
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
