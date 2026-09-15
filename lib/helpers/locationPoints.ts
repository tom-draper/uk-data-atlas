import type { CustomPoint } from "@/lib/types/custom";

type Bounds = [number, number, number, number] | null | undefined;

/** What a point needs to know about named locations to place itself in one. */
export type LocationLookup = {
	membersOf: (location: string) => string[];
	boundsOf: (location: string) => Bounds;
};

const COUNTRY_PREFIXES: Record<string, string> = {
	England: "E",
	Scotland: "S",
	Wales: "W",
	"Northern Ireland": "N",
};

// Point subsets contain references to the original records, but retaining every
// visited location would still grow over a long session. Keep only recent bounds
// for each point dataset.
const LOCATION_POINT_CACHE_LIMIT = 20;
const locationSubsetCache = new WeakMap<
	CustomPoint[],
	Map<string, CustomPoint[]>
>();
const pointSubsetCache = new WeakMap<
	CustomPoint[],
	Map<string, CustomPoint[]>
>();

export const getPointsInBounds = (
	points: CustomPoint[],
	bounds: Bounds,
): CustomPoint[] => {
	if (!bounds) return points;

	let cache = pointSubsetCache.get(points);
	if (!cache) {
		cache = new Map();
		pointSubsetCache.set(points, cache);
	}

	const cacheKey = bounds.join(",");
	const cached = cache.get(cacheKey);
	if (cached) {
		cache.delete(cacheKey);
		cache.set(cacheKey, cached);
		return cached;
	}

	const [west, south, east, north] = bounds;
	const subset = points.filter(
		(point) =>
			point.lng >= west &&
			point.lng <= east &&
			point.lat >= south &&
			point.lat <= north,
	);

	if (cache.size >= LOCATION_POINT_CACHE_LIMIT) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) cache.delete(oldestKey);
	}
	cache.set(cacheKey, subset);

	return subset;
};

const inBounds = (point: CustomPoint, bounds: Bounds) => {
	if (!bounds) return false;
	const [west, south, east, north] = bounds;
	return (
		point.lng >= west &&
		point.lng <= east &&
		point.lat >= south &&
		point.lat <= north
	);
};

/**
 * The points that belong to a named location. A point with an `areaCode` is
 * placed the way boundary datasets are: in a country by its code's prefix, and
 * in any other location by that location's member authorities. A bounding box
 * reaches into neighbouring areas, as Northern Ireland's does into Kintyre, so
 * it is used only for points without a code, such as uploaded coordinates, and
 * for a location with no members.
 */
export const getPointsInLocation = (
	points: CustomPoint[],
	location: string | null | undefined,
	lookup: LocationLookup,
): CustomPoint[] => {
	if (!location || location === "United Kingdom") return points;

	let cache = locationSubsetCache.get(points);
	if (!cache) {
		cache = new Map();
		locationSubsetCache.set(points, cache);
	}
	const cached = cache.get(location);
	if (cached) {
		cache.delete(location);
		cache.set(location, cached);
		return cached;
	}

	const prefix = COUNTRY_PREFIXES[location];
	const members = new Set(lookup.membersOf(location));
	const bounds = lookup.boundsOf(location);
	const subset = points.filter((point) => {
		if (!point.areaCode) return inBounds(point, bounds);
		if (prefix) return point.areaCode.startsWith(prefix);
		return members.size > 0
			? members.has(point.areaCode)
			: inBounds(point, bounds);
	});

	if (cache.size >= LOCATION_POINT_CACHE_LIMIT) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) cache.delete(oldestKey);
	}
	cache.set(location, subset);
	return subset;
};
