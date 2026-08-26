import type { CustomPoint } from "@/lib/types/custom";

type Bounds = [number, number, number, number] | null | undefined;

// Point subsets contain references to the original records, but retaining every
// visited location would still grow over a long session. Keep only recent bounds
// for each point dataset.
const LOCATION_POINT_CACHE_LIMIT = 20;
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
