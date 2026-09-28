/**
 * The two values the application derives from boundary coordinates: area, for
 * population density, and extent, for fitting the map to an area.
 *
 * `scripts/compile-boundaries.mts` computes both from the finished topology
 * and serves them in the release's properties sidecar, so a vintage held as
 * properties alone can still answer for them. Each helper falls back to the
 * geometry, which keeps an uploaded file — compiled by nobody — working.
 */
import type { Feature } from "@lib/types";
import { polygonAreaSqKm } from "@/lib/helpers/population";

type Extent = [number, number, number, number];

// Re-deriving either value walks every vertex, so a feature is measured once.
const areaCache = new WeakMap<object, number>();
const extentCache = new WeakMap<object, Extent | null>();

const readNumber = (feature: Feature, key: string): number | undefined => {
	const value = Reflect.get(feature.properties, key);
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
};

const readExtent = (feature: Feature): Extent | undefined => {
	const value = Reflect.get(feature.properties, "bbox");
	return Array.isArray(value) &&
		value.length === 4 &&
		value.every((part) => typeof part === "number")
		? (value as Extent)
		: undefined;
};

/** Land area in square kilometres. Zero for a feature with neither source. */
export const featureAreaSqKm = (feature: Feature): number => {
	const compiled = readNumber(feature, "areaSqKm");
	if (compiled !== undefined) return compiled;
	if (!feature.geometry) return 0;

	const cached = areaCache.get(feature.geometry);
	if (cached !== undefined) return cached;
	const area = polygonAreaSqKm(feature.geometry);
	areaCache.set(feature.geometry, area);
	return area;
};

/** Bounding box as [west, south, east, north], or null if it cannot be known. */
export const featureExtent = (feature: Feature): Extent | null => {
	const compiled = readExtent(feature);
	if (compiled) return compiled;
	if (!feature.geometry) return null;

	const cached = extentCache.get(feature.geometry);
	if (cached !== undefined) return cached;

	let west = Infinity,
		south = Infinity,
		east = -Infinity,
		north = -Infinity;
	// Positions nest to a different depth for Polygon and MultiPolygon, so the
	// walker recurses until it reaches a [lon, lat] pair.
	type Positions = number[] | Positions[];
	const walk = (coordinates: Positions): void => {
		const [first] = coordinates;
		if (typeof first === "number") {
			const [longitude, latitude] = coordinates as number[];
			west = Math.min(west, longitude!);
			east = Math.max(east, longitude!);
			south = Math.min(south, latitude!);
			north = Math.max(north, latitude!);
			return;
		}
		for (const part of coordinates as Positions[]) walk(part);
	};
	walk(feature.geometry.coordinates as Positions);

	const extent: Extent | null =
		west === Infinity ? null : [west, south, east, north];
	extentCache.set(feature.geometry, extent);
	return extent;
};
