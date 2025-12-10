// lib/data/boundaries.ts
import { BoundaryGeojson } from "@lib/types";
import { LOCATIONS } from "@lib/data/locations";
import { withCDN } from "@/lib/utils/cdn";
import * as topojson from "topojson-client";

export const GEOJSON_PATHS = {
    ward: {
        2024: withCDN('/data/boundaries/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.topojson'),
        2023: withCDN('/data/boundaries/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.topojson'),
        2022: withCDN('/data/boundaries/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.topojson'),
        2021: withCDN('/data/boundaries/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.topojson'),
    },
    constituency: {
        2024: withCDN('/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC_-8097874740651686118.topojson'),
        2019: withCDN('/data/boundaries/constituencies/WPC_Dec_2019_GCB_UK_2022_-6554439877584414509.topojson'),
        2017: withCDN('/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.topojson'),
        2015: withCDN('/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.topojson'),
    },
    localAuthority: {
        2025: withCDN('/data/boundaries/lad/LAD_MAY_2025_UK_BGC_V2_1110015208521213948.topojson'),
        2024: withCDN('/data/boundaries/lad/Local_Authority_Districts_May_2024_Boundaries_UK_BGC_-6307115499537197728.topojson'),
        2023: withCDN('/data/boundaries/lad/Local_Authority_Districts_May_2023_UK_BGC_V2_606764927733448598.topojson'),
        2022: withCDN('/data/boundaries/lad/Local_Authority_Districts_December_2022_UK_BGC_V2_8941445649355329203.topojson'),
        2021: withCDN('/data/boundaries/lad/Local_Authority_Districts_December_2021_UK_BGC_2022_4923559779027843470.topojson'),
    }
} as const;

export type BoundaryType = keyof typeof GEOJSON_PATHS;
export type WardYear = keyof typeof GEOJSON_PATHS.ward;
export type ConstituencyYear = keyof typeof GEOJSON_PATHS.constituency;
export type LocalAuthorityYear = keyof typeof GEOJSON_PATHS.localAuthority;

// Property keys for each boundary type (prioritized by year)
export const WARD_CODE_KEYS = ["WD24CD", "WD23CD", "WD22CD", "WD21CD"] as const;
export const WARD_NAME_KEYS = ["WD24NM", "WD23NM", "WD22NM", "WD21NM"] as const;
export const LAD_CODE_KEYS = ["LAD25CD", "LAD24CD", "LAD23CD", "LAD22CD", "LAD21CD"] as const;
export const LAD_NAME_KEYS = ["LAD25NM", "LAD24NM", "LAD23NM", "LAD22NM", "LAD21NM"] as const;
export const CONSTITUENCY_CODE_KEYS = ["PCON24CD", "pcon19cd", "PCON17CD", "PCON15CD"] as const;
export const CONSTITUENCY_NAME_KEYS = ["PCON24NM", "pcon19nm", "PCON17NM", "PCON15NM"] as const;

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
} as const;

const COUNTRY_PREFIXES: Record<string, string> = {
    "England": "E",
    "Scotland": "S",
    "Wales": "W",
    "Northern Ireland": "N",
};

const BOUNDARY_CACHE: Record<string, BoundaryGeojson> = {};

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

/**
 * Fast AABB (Axis-Aligned Bounding Box) intersection check
 */
const isFeatureInBounds = (
    feature: any,
    bounds: [number, number, number, number],
): boolean => {
    const [west, south, east, north] = bounds;

    if (!feature.geometry?.coordinates) return false;

    const flatCoords = feature.geometry.type === "MultiPolygon"
        ? feature.geometry.coordinates.flat(2)
        : feature.geometry.coordinates.flat(1);

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const [x, y] of flatCoords) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }

    return minX <= east && maxX >= west && minY <= north && maxY >= south;
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
    };
    return keyMap[type];
};

/**
 * Fetch and cache boundary file (supports both GeoJSON and TopoJSON)
 */
export const fetchBoundaryFile = async (
    path: string,
): Promise<BoundaryGeojson> => {
    // Return cached version if available
    if (BOUNDARY_CACHE[path]) {
        return BOUNDARY_CACHE[path];
    }

    const res = await fetch(path);
    if (!res.ok) {
        throw new Error(
            `Failed to fetch ${path}: ${res.status} ${res.statusText}`,
        );
    }

    const json = await res.json();

    // Convert TopoJSON to GeoJSON if needed
    let geojson: BoundaryGeojson;
    if (json.type === "Topology") {
        const objectKey = Object.keys(json.objects)[0];
        geojson = topojson.feature(
            json,
            json.objects[objectKey],
        ) as BoundaryGeojson;
    } else {
        geojson = json;
    }

    // Cache the result
    BOUNDARY_CACHE[path] = geojson;

    return geojson;
};

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

    const locData = LOCATIONS[location];
    if (!locData) {
        console.warn(`Location data not found for: ${location}`);
        return geojson;
    }

    // Filter wards by LAD code (uses getLadForWard for 2021 data without LAD properties)
    if (type === "ward" && locData.lad_codes?.length) {
        return {
            ...geojson,
            features: geojson.features.filter((f) => {
                const wardCode = getProp(f.properties, PROPERTY_KEYS.wardCode);
                let ladCode = getProp(f.properties, PROPERTY_KEYS.ladCode)
                const mappedLadCode = (wardCode && getLadForWard ? getLadForWard(wardCode) : undefined);
                ladCode = ladCode || mappedLadCode;
                return ladCode && locData.lad_codes.includes(ladCode);
            }),
        };
    }

    // Filter local authorities by LAD code
    if (type === "localAuthority" && locData.lad_codes?.length) {
        return {
            ...geojson,
            features: geojson.features.filter((f) => {
                const ladCode = getProp(f.properties, PROPERTY_KEYS.ladCode);
                return ladCode && locData.lad_codes.includes(ladCode);
            }),
        };
    }

    // Filter constituencies by bounding box
    if (type === "constituency" && locData.bounds) {
        return {
            ...geojson,
            features: geojson.features.filter((f) =>
                isFeatureInBounds(f, locData.bounds!)
            ),
        };
    }

    return geojson;
};

/**
 * Clear the cache (useful for testing or memory management)
 */
export const clearCache = (): void => {
    Object.keys(BOUNDARY_CACHE).forEach((key) => delete BOUNDARY_CACHE[key]);
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => ({
    cachedFiles: Object.keys(BOUNDARY_CACHE).length,
    estimatedMemory: JSON.stringify(BOUNDARY_CACHE).length,
});