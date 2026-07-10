// lib/data/boundaries.ts
import { BoundaryGeojson } from "@lib/types";
import { gazetteer } from "@lib/data/gazetteer/static";
import { withCDN } from "@/lib/helpers/cdn";
import * as topojson from "topojson-client";
import {
	FeatureCollection,
	Geometry,
	GeoJsonProperties,
	Feature,
} from "geojson";

interface GeoJsonFeatureCollection extends FeatureCollection<
	Geometry,
	GeoJsonProperties
> {
	crs?: {
		type: string;
		properties: {
			name: string;
		};
	};
}

export const GEOJSON_PATHS = {
	ward: {
		2025: withCDN(
			"/data/boundaries/wards/WD_MAY_2025_UK_BGC_V2_-8581021362622909866.topojson",
		),
		2024: withCDN(
			"/data/boundaries/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.topojson",
		),
		2023: withCDN(
			"/data/boundaries/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.topojson",
		),
		2022: withCDN(
			"/data/boundaries/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.topojson",
		),
		2021: withCDN(
			"/data/boundaries/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.topojson",
		),
	},
	constituency: {
		2024: withCDN(
			"/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC_-8097874740651686118.topojson",
		),
		2019: withCDN(
			"/data/boundaries/constituencies/WPC_Dec_2019_GCB_UK_2022_-6554439877584414509.topojson",
		),
		2017: withCDN(
			"/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.topojson",
		),
		2015: withCDN(
			"/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.topojson",
		),
	},
	localAuthority: {
		2025: withCDN(
			"/data/boundaries/lad/LAD_MAY_2025_UK_BGC_V2_1110015208521213948.topojson",
		),
		2024: withCDN(
			"/data/boundaries/lad/Local_Authority_Districts_May_2024_Boundaries_UK_BGC_-6307115499537197728.topojson",
		),
		2023: withCDN(
			"/data/boundaries/lad/Local_Authority_Districts_May_2023_UK_BGC_V2_606764927733448598.topojson",
		),
		// 2021: broken topojson - commented out intentionally
		// 2021: withCDN(
		// 	"/data/boundaries/lad/Local_Authority_Districts_December_2021_UK_BGC_2022_4923559779027843470.topojson",
		// ),
		2016: withCDN(
			"/data/boundaries/lad/LAD_Dec_2016_GB_BGC_WGS84.topojson",
		),
	},
	lsoa: {
		2011: withCDN(
			"/data/boundaries/lsoa/LSOA_Dec_2011_Boundaries_Generalised_Clipped_BGC_EW_V3_1201710622178571867.topojson",
		),
	},
	dataZone: {
		2011: withCDN(
			"/data/boundaries/datazone/SG_DataZone_Bdry_2011.topojson",
		),
	},
	superOutputArea: {
		2011: withCDN("/data/boundaries/superOutputArea/NI_SOA_2011.topojson"),
	},
} as const;

export type BoundaryType = keyof typeof GEOJSON_PATHS;
export type WardYear = keyof typeof GEOJSON_PATHS.ward;
export type ConstituencyYear = keyof typeof GEOJSON_PATHS.constituency;
export type LocalAuthorityYear = keyof typeof GEOJSON_PATHS.localAuthority;

// Property keys for each boundary type (prioritized by year)
export const WARD_CODE_KEYS = [
	"WD25CD",
	"WD24CD",
	"WD23CD",
	"WD22CD",
	"WD21CD",
] as const;
const WARD_NAME_KEYS = [
	"WD25NM",
	"WD24NM",
	"WD23NM",
	"WD22NM",
	"WD21NM",
] as const;
export const LAD_CODE_KEYS = [
	"LAD25CD",
	"LAD24CD",
	"LAD23CD",
	"LAD22CD",
	"LAD21CD",
	"LAD16CD",
] as const;
const LAD_NAME_KEYS = [
	"LAD25NM",
	"LAD24NM",
	"LAD23NM",
	"LAD22NM",
	"LAD21NM",
	"LAD16NM",
] as const;
export const CONSTITUENCY_CODE_KEYS = [
	"PCON24CD",
	"pcon19cd",
	"PCON17CD",
	"PCON15CD",
] as const;
const CONSTITUENCY_NAME_KEYS = [
	"PCON24NM",
	"pcon19nm",
	"PCON17NM",
	"PCON15NM",
] as const;

export const LSOA_CODE_KEYS = ["LSOA11CD", "LSOA21CD"] as const;
const LSOA_NAME_KEYS = ["LSOA11NM", "LSOA21NM"] as const;
export type LSOACodeKey = (typeof LSOA_CODE_KEYS)[number];
export type LSOANameKey = (typeof LSOA_NAME_KEYS)[number];

export const DATA_ZONE_CODE_KEYS = ["DataZone"] as const;
const DATA_ZONE_NAME_KEYS = ["Name"] as const;
export type DataZoneCodeKey = (typeof DATA_ZONE_CODE_KEYS)[number];
export type DataZoneNameKey = (typeof DATA_ZONE_NAME_KEYS)[number];

export const SOA_CODE_KEYS = ["SOA_CODE", "SOA2011", "SOA"] as const;
const SOA_NAME_KEYS = ["SOA_LABEL", "SOA2011 Name", "SOA Name"] as const;
export type SOACodeKey = (typeof SOA_CODE_KEYS)[number];
export type SOANameKey = (typeof SOA_NAME_KEYS)[number];

export type WardCodeKey = (typeof WARD_CODE_KEYS)[number];
export type WardNameKey = (typeof WARD_NAME_KEYS)[number];
export type LADCodeKey = (typeof LAD_CODE_KEYS)[number];
export type LADNameKey = (typeof LAD_NAME_KEYS)[number];
export type ConstituencyCodeKey = (typeof CONSTITUENCY_CODE_KEYS)[number];
export type ConstituencyNameKey = (typeof CONSTITUENCY_NAME_KEYS)[number];

export const PROPERTY_KEYS = {
	wardCode: WARD_CODE_KEYS,
	wardName: WARD_NAME_KEYS,
	ladCode: LAD_CODE_KEYS,
	ladName: LAD_NAME_KEYS,
	constituencyCode: CONSTITUENCY_CODE_KEYS,
	constituencyName: CONSTITUENCY_NAME_KEYS,
	lsoaCode: LSOA_CODE_KEYS,
	lsoaName: LSOA_NAME_KEYS,
	dataZoneCode: DATA_ZONE_CODE_KEYS,
	dataZoneName: DATA_ZONE_NAME_KEYS,
	soaCode: SOA_CODE_KEYS,
	soaName: SOA_NAME_KEYS,
} as const;

const COUNTRY_PREFIXES: Record<string, string> = {
	England: "E",
	Scotland: "S",
	Wales: "W",
	"Northern Ireland": "N",
};

// We retain only the raw *serialized* TopoJSON/GeoJSON text for each vintage.
// Parsing it into JS objects inflates it ~8x (TopoJSON arcs become millions of
// tiny [x,y] arrays), and decoding into coordinate-expanded GeoJSON is larger
// still. Both the parsed and decoded forms are produced on demand from the cached
// text and left to be garbage-collected, so the full-UK geometry for every vintage
// is never held in memory at once. Caching text (~97MB for all vintages) rather
// than parsed objects (~645MB) keeps location changes instant — no refetch — at a
// fraction of the resident footprint.
const RAW_CACHE: Record<string, string> = {};
const RAW_PENDING: Partial<Record<string, Promise<string>>> = {};

/**
 * Find the first available property from a list of possible keys
 */
export const getProp = (
	props: any,
	keys: readonly string[],
): string | undefined => {
	for (const key of keys) {
		if (key in props && props[key]) return props[key];
	}
	return undefined;
};

// Axis-aligned bounding box of a feature's geometry, [minX, minY, maxX, maxY], or
// null if it has no coordinates. Shared by the runtime map filter and the load-time
// index build so both locate features identically.
export const featureBbox = (
	feature: any,
): [number, number, number, number] | null => {
	if (!feature.geometry?.coordinates) return null;

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

	return [minX, minY, maxX, maxY];
};

const bboxIntersectsBounds = (
	bbox: [number, number, number, number],
	bounds: [number, number, number, number],
): boolean => {
	const [west, south, east, north] = bounds;
	const [minX, minY, maxX, maxY] = bbox;
	return minX <= east && maxX >= west && minY <= north && maxY >= south;
};

/**
 * Fast AABB (Axis-Aligned Bounding Box) intersection check
 */
const isFeatureInBounds = (
	feature: any,
	bounds: [number, number, number, number],
): boolean => {
	const bbox = featureBbox(feature);
	return bbox ? bboxIntersectsBounds(bbox, bounds) : false;
};

/**
 * Get property keys for a given boundary type
 */
const getPropertyKeys = (type: BoundaryType) => {
	const keyMap = {
		ward: {
			code: PROPERTY_KEYS.wardCode,
			name: PROPERTY_KEYS.wardName,
		},
		constituency: {
			code: PROPERTY_KEYS.constituencyCode,
			name: PROPERTY_KEYS.constituencyName,
		},
		localAuthority: {
			code: PROPERTY_KEYS.ladCode,
			name: PROPERTY_KEYS.ladName,
		},
		lsoa: {
			code: PROPERTY_KEYS.lsoaCode,
			name: PROPERTY_KEYS.lsoaName,
		},
		dataZone: {
			code: PROPERTY_KEYS.dataZoneCode,
			name: PROPERTY_KEYS.dataZoneName,
		},
		superOutputArea: {
			code: PROPERTY_KEYS.soaCode,
			name: PROPERTY_KEYS.soaName,
		},
	};
	return keyMap[type];
};

/**
 * Fetch and cache the raw TopoJSON/GeoJSON *text* for a path (no parsing).
 */
async function doFetchRawBoundaryText(path: string): Promise<string> {
	const res = await fetch(path);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
	}
	const text = await res.text();
	RAW_CACHE[path] = text;
	delete RAW_PENDING[path];
	return text;
}

/**
 * Fetch the compact source text for a boundary path, caching the text (not the
 * parsed object). Use this to warm the cache when the parsed form isn't needed yet.
 */
export function fetchRawBoundaryText(path: string): Promise<string> {
	const cached = RAW_CACHE[path];
	if (cached !== undefined) return Promise.resolve(cached);
	if (RAW_PENDING[path]) return RAW_PENDING[path]!;

	const promise = doFetchRawBoundaryText(path);
	RAW_PENDING[path] = promise;
	promise.catch(() => { delete RAW_PENDING[path]; });
	return promise;
}

/**
 * Fetch a boundary path and return the parsed (but not yet decoded) TopoJSON/GeoJSON.
 * The parse result is intentionally transient: only the compact source text is
 * cached, so callers should decode + extract what they need and let both the parsed
 * and decoded objects be garbage-collected.
 */
export function fetchRawBoundary(path: string): Promise<unknown> {
	return fetchRawBoundaryText(path).then((text) => JSON.parse(text));
}

/**
 * Decode raw TopoJSON/GeoJSON into a fresh GeoJSON FeatureCollection.
 * Intentionally NOT cached: callers should extract what they need (codes,
 * location-filtered features) and let the decoded geometry be garbage-collected.
 */
export function decodeBoundary(raw: unknown): BoundaryGeojson {
	const json = raw as any;

	let geojson: GeoJsonFeatureCollection;
	if (json.type === "Topology") {
		const objectKey = Object.keys(json.objects)[0];
		const topojsonFeatureResult:
			| Feature<Geometry, GeoJsonProperties>
			| FeatureCollection<Geometry, GeoJsonProperties> = topojson.feature(
			json,
			json.objects[objectKey] as any,
		);

		if (topojsonFeatureResult.type === "Feature") {
			geojson = { type: "FeatureCollection", features: [topojsonFeatureResult] };
		} else {
			geojson = topojsonFeatureResult;
		}
	} else {
		geojson = json as GeoJsonFeatureCollection;
	}

	if (!geojson.crs) {
		geojson.crs = {
			type: "name",
			properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
		};
	}

	return geojson as BoundaryGeojson<any>;
}

/**
 * Fetch a boundary file and return decoded GeoJSON.
 * Convenience wrapper for one-off consumers; decodes from the cached raw data.
 */
export function fetchBoundaryFile(path: string): Promise<BoundaryGeojson> {
	return fetchRawBoundary(path).then(decodeBoundary);
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
				const wardCode = getProp(f.properties, PROPERTY_KEYS.wardCode);
				let ladCode = getProp(f.properties, PROPERTY_KEYS.ladCode);
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
				const ladCode = getProp(f.properties, PROPERTY_KEYS.ladCode);
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

// A geometry-free feature: properties for chart aggregation + a bbox so bbox-based
// types (LSOA / constituency / DataZone / SOA) can be located without coordinates.
export interface IndexFeature {
	properties: Record<string, unknown>;
	bbox: [number, number, number, number];
}

/**
 * Location-filter a geometry-free index, mirroring filterFeatures exactly but on
 * {properties, bbox} instead of full geometry, and returning null-geometry features.
 * The chart panel reads only properties, so it can run off this with no decode and
 * no per-navigation geometry work.
 */
export const filterIndexToLocation = (
	index: IndexFeature[],
	location: string | null,
	type: BoundaryType,
	getLadForWard?: (wardCode: string) => string | undefined,
): BoundaryGeojson => {
	const toFC = (feats: IndexFeature[]): BoundaryGeojson =>
		({
			type: "FeatureCollection",
			features: feats.map((f) => ({
				type: "Feature",
				geometry: null,
				properties: f.properties,
			})),
		}) as unknown as BoundaryGeojson;

	if (!location || location === "United Kingdom") return toFC(index);

	const { code: codeKeys } = getPropertyKeys(type);

	if (COUNTRY_PREFIXES[location]) {
		const prefix = COUNTRY_PREFIXES[location];
		return toFC(
			index.filter((f) => getProp(f.properties, codeKeys)?.startsWith(prefix)),
		);
	}

	const loc = gazetteer.namedLocation(location);
	if (!loc) return toFC(index);

	if (type === "ward" && loc.memberCodes?.length) {
		const ladCodeSet = new Set(loc.memberCodes);
		return toFC(
			index.filter((f) => {
				const wardCode = getProp(f.properties, PROPERTY_KEYS.wardCode);
				let ladCode = getProp(f.properties, PROPERTY_KEYS.ladCode);
				const mappedLadCode =
					wardCode && getLadForWard ? getLadForWard(wardCode) : undefined;
				ladCode = ladCode || mappedLadCode;
				return !!ladCode && ladCodeSet.has(ladCode);
			}),
		);
	}

	if (type === "localAuthority" && loc.memberCodes?.length) {
		const ladCodeSet = new Set(loc.memberCodes);
		return toFC(
			index.filter((f) => {
				const ladCode = getProp(f.properties, PROPERTY_KEYS.ladCode);
				return !!ladCode && ladCodeSet.has(ladCode);
			}),
		);
	}

	if (loc.bbox) {
		const bounds = loc.bbox;
		return toFC(index.filter((f) => bboxIntersectsBounds(f.bbox, bounds)));
	}

	return toFC(index);
};

/**
 * Clear the raw boundary cache (useful for testing or memory management)
 */
export const clearBoundaryCache = (): void => {
	Object.keys(RAW_CACHE).forEach((key) => delete RAW_CACHE[key]);
};

// Read the cached raw text for a path without fetching (undefined if not cached).
export const peekBoundaryText = (path: string): string | undefined =>
	RAW_CACHE[path];
