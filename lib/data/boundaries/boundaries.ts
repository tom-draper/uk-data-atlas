import { BoundaryGeojson } from '@lib/types';
import { LOCATIONS } from '@lib/data/locations';

export const GEOJSON_PATHS = {
    ward: {
        2024: '/data/boundaries/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson',
        2023: '/data/boundaries/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson',
        2022: '/data/boundaries/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson',
        2021: '/data/boundaries/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson',
    },
    constituency: {
        2024: '/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC_-8097874740651686118.geojson',
        2019: '/data/boundaries/constituencies/WPC_Dec_2019_GCB_UK_2022_-6554439877584414509.geojson',
        2017: '/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.geojson',
        2015: '/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.geojson',
    }
} as const;

export type BoundaryType = keyof typeof GEOJSON_PATHS;

export type WardYear = keyof typeof GEOJSON_PATHS.ward;
export type ConstituencyYear = keyof typeof GEOJSON_PATHS.constituency;

// Constituency property keys - adjust these based on your actual GeoJSON properties
export const WARD_CODE_KEYS = ['WD24CD', 'WD23CD', 'WD22CD', 'WD21CD'] as const;
export const WARD_NAME_KEYS = ['WD24NM', 'WD23NM', 'WD22NM', 'WD21NM'] as const;
export const LAD_CODE_KEYS = ['LAD24CD', 'LAD23CD', 'LAD22CD', 'LAD21CD'] as const;
export const CONSTITUENCY_CODE_KEYS = ['PCON24CD', 'PCON19CD', 'PCON17CD', 'PCON15CD'] as const;
export const CONSTITUENCY_NAME_KEYS = ['PCON24NM', 'PCON19NM', 'PCON17NM', 'PCON15NM'] as const;

export type WardCodeKey = (typeof WARD_CODE_KEYS)[number];
export type WardNameKey = (typeof WARD_NAME_KEYS)[number];
export type ConstituencyCodeKey = (typeof CONSTITUENCY_CODE_KEYS)[number];
export type ConstituencyNameKey = (typeof CONSTITUENCY_NAME_KEYS)[number];


// Keys configuration
export const PROPERTY_KEYS = {
    wardCode: ['WD24CD', 'WD23CD', 'WD22CD', 'WD21CD'],
    ladCode: ['LAD24CD', 'LAD23CD', 'LAD22CD', 'LAD21CD'],
    constituencyCode: ['PCON24CD', 'pcon19cd', 'PCON17CD', 'PCON15CD'],
} as const;

const COUNTRY_PREFIXES: Record<string, string> = {
    'England': 'E', 'Scotland': 'S', 'Wales': 'W', 'Northern Ireland': 'N'
};

// --- Module Level Cache (Persists across re-renders) ---
const GLOBAL_CACHE: Record<string, BoundaryGeojson> = {};
const WARD_TO_LAD_MAP: Record<string, string> = {};

// --- Helper Functions ---

// Generic property finder
export const getProp = (props: any, keys: readonly string[]) => {
    const key = keys.find(k => k in props);
    return key ? props[key] : undefined;
};

// Build lookup map once per dataset
export const populateLadMap = (features: any[]) => {
    // Optimization: Only process if we haven't seen these features, 
    // or just process lazily. For now, we run it on load.
    features.forEach(f => {
        const wCode = getProp(f.properties, PROPERTY_KEYS.wardCode);
        const lCode = getProp(f.properties, PROPERTY_KEYS.ladCode);
        if (wCode && lCode) WARD_TO_LAD_MAP[wCode] = lCode;
    });
};

// FAST Bounding Box Check (AABB Intersection)
// Much faster than iterating every coordinate
const isFeatureInBounds = (feature: any, bounds: [number, number, number, number]) => {
    const [west, south, east, north] = bounds;

    // If feature already has a bbox, use it. If not, we might need to compute it once.
    // Assuming raw GeoJSON doesn't always have bbox, checking the first coordinate 
    // is a cheap heuristic, but calculating extent is safer.

    // Simplified check: Does the feature have ANY geometry?
    if (!feature.geometry?.coordinates) return false;

    // Deep traverse to find min/max lng/lat of the feature
    // Note: For critical performance, use a library like 'geojson-bounds' or 'turf/bbox'
    // Here is a simplified flattening approach:
    const flatCoords = feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates.flat(2)
        : feature.geometry.coordinates.flat(1);

    let fMinX = Infinity, fMinY = Infinity, fMaxX = -Infinity, fMaxY = -Infinity;

    for (const [x, y] of flatCoords) {
        if (x < fMinX) fMinX = x;
        if (x > fMaxX) fMaxX = x;
        if (y < fMinY) fMinY = y;
        if (y > fMaxY) fMaxY = y;
    }

    // Check for Overlap
    return (fMinX <= east && fMaxX >= west && fMinY <= north && fMaxY >= south);
};

export const fetchBoundaryFile = async (path: string): Promise<BoundaryGeojson> => {
    if (GLOBAL_CACHE[path]) return GLOBAL_CACHE[path];

    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}`);

    const json = await res.json();
    GLOBAL_CACHE[path] = json;

    // Side effect: populate map if it looks like ward data
    if (json.features?.length && getProp(json.features[0].properties, PROPERTY_KEYS.wardCode)) {
        populateLadMap(json.features);
    }

    return json;
};

export const filterFeatures = (
    geojson: BoundaryGeojson,
    location: string | null,
    type: 'ward' | 'constituency'
): BoundaryGeojson => {
    if (!location || location === 'United Kingdom') return geojson;

    // 1. Filter by Country Prefix
    if (COUNTRY_PREFIXES[location]) {
        const prefix = COUNTRY_PREFIXES[location];
        const keys = type === 'ward' ? PROPERTY_KEYS.wardCode : PROPERTY_KEYS.constituencyCode;

        return {
            ...geojson,
            features: geojson.features.filter(f => {
                const code = getProp(f.properties, keys);
                return code?.startsWith(prefix);
            })
        };
    }

    const locData = LOCATIONS[location];
    if (!locData) return geojson;

    // 2. Filter Wards by LAD Code
    if (type === 'ward' && locData.lad_codes?.length) {
        return {
            ...geojson,
            features: geojson.features.filter(f => {
                const wCode = getProp(f.properties, PROPERTY_KEYS.wardCode);
                const lCode = getProp(f.properties, PROPERTY_KEYS.ladCode) || WARD_TO_LAD_MAP[wCode];
                return locData.lad_codes.includes(lCode);
            })
        };
    }

    // 3. Filter Constituency by Bounds
    if (type === 'constituency' && locData.bounds) {
        return {
            ...geojson,
            features: geojson.features.filter(f => isFeatureInBounds(f, locData.bounds!))
        };
    }

    return geojson;
};