import type { Pair, Polygon } from "polygon-clipping";
import {
	polygonAreaM2,
	polygonPerimeterM,
	projectEqualArea,
	unprojectEqualArea,
} from "./areaOverlap";
import type { GeoJsonGeometry } from "./areaGeometry";
import {
	containPoint,
	geometryBounds,
	type Coordinate,
	type GeometryBounds,
} from "./areaContainment";

/**
 * How a label point was chosen. The centroid of a crescent or a split island
 * can fall outside the area it names, so a point that must sit inside is a
 * different question from where the mass is.
 */
export type LabelPointMethod = "centroid" | "interior-span";

export type AreaMetrics = {
	boundingBox: GeometryBounds;
	centroid: Coordinate;
	labelPoint: Coordinate;
	labelPointMethod: LabelPointMethod;
	areaM2: number;
	areaHectares: number;
	areaKm2: number;
	perimeterM: number;
	perimeterKm: number;
	parts: number;
	rings: number;
	vertices: number;
};

/** Every Polygon in a geometry, including those nested in a collection. */
const polygonsOf = (geometry: GeoJsonGeometry): Polygon[] => {
	if (geometry.type === "GeometryCollection") {
		return (geometry.geometries ?? []).flatMap(polygonsOf);
	}
	const rings = (
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? geometry.coordinates
				: []
	) as unknown[];
	if (!Array.isArray(rings)) return [];
	return (rings as number[][][][]).map((polygon) =>
		polygon.map((ring) => ring.map(([x, y]) => [x, y] as Pair)),
	);
};

/**
 * A ring's signed area and first moments, in the equal-area projection.
 *
 * Orientation is not relied on: GeoJSON does not guarantee it, and flipping a
 * ring negates the area and both moments together, so the centroid they give
 * is the same either way. The caller supplies the sign it wants.
 */
const ringMoments = (ring: Pair[]) => {
	const projected = ring.map(projectEqualArea);
	let twiceArea = 0;
	let momentX = 0;
	let momentY = 0;
	for (let i = 0, j = projected.length - 1; i < projected.length; j = i++) {
		const [xj, yj] = projected[j]!;
		const [xi, yi] = projected[i]!;
		const cross = xj * yi - xi * yj;
		twiceArea += cross;
		momentX += (xj + xi) * cross;
		momentY += (yj + yi) * cross;
	}
	return { area: twiceArea / 2, momentX: momentX / 6, momentY: momentY / 6 };
};

/**
 * The area-weighted centroid, taken in the equal-area projection so that every
 * part contributes in proportion to its true ground area, then brought back to
 * WGS84. Holes are subtracted, so a ring of land centres on the ring.
 */
const centroidOf = (polygons: Polygon[]): Coordinate | undefined => {
	let area = 0;
	let momentX = 0;
	let momentY = 0;
	for (const [outer, ...holes] of polygons) {
		if (!outer) continue;
		for (const [ring, weight] of [
			[outer, 1] as const,
			...holes.map((hole) => [hole, -1] as const),
		]) {
			const moments = ringMoments(ring);
			// Normalise to positive-for-outer, whichever way the ring was wound.
			const sign = (moments.area < 0 ? -1 : 1) * weight;
			area += sign * moments.area;
			momentX += sign * moments.momentX;
			momentY += sign * moments.momentY;
		}
	}
	if (area === 0) return undefined;
	return unprojectEqualArea([momentX / area, momentY / area]);
};

/**
 * The midpoint of the widest run of interior at some latitude, used when the
 * centroid falls outside. Latitudes are sampled across the bounding box rather
 * than only at the centroid's, so a shape whose centroid sits in a bay still
 * gets the widest span its geometry offers.
 */
const SAMPLES = 21;
const interiorSpan = (
	polygons: Polygon[],
	bounds: GeometryBounds,
): Coordinate | undefined => {
	const [, minLatitude, , maxLatitude] = bounds;
	let best: { width: number; point: Coordinate } | undefined;
	for (let step = 1; step < SAMPLES; step += 1) {
		const latitude =
			minLatitude + ((maxLatitude - minLatitude) * step) / SAMPLES;
		const crossings: number[] = [];
		for (const polygon of polygons) {
			for (const ring of polygon) {
				for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
					const [x1, y1] = ring[j]!;
					const [x2, y2] = ring[i]!;
					if (y1 === y2) continue;
					if (latitude < Math.min(y1, y2)) continue;
					if (latitude >= Math.max(y1, y2)) continue;
					crossings.push(
						x1 + ((latitude - y1) / (y2 - y1)) * (x2 - x1),
					);
				}
			}
		}
		crossings.sort((left, right) => left - right);
		// Even-odd: the run between an odd crossing and the next is inside.
		for (let i = 0; i + 1 < crossings.length; i += 2) {
			const width = crossings[i + 1]! - crossings[i]!;
			if (!best || width > best.width) {
				best = {
					width,
					point: [(crossings[i]! + crossings[i + 1]!) / 2, latitude],
				};
			}
		}
	}
	return best?.point;
};

/**
 * Bounding box, centroid, label point, area and perimeter for one area's
 * geometry. Returns undefined for geometry carrying no polygon, such as the
 * point sources a few releases are held as.
 *
 * Area and perimeter are ellipsoidal, not planar: area through the EPSG:6933
 * equal-area projection, perimeter from the ellipsoid's radii of curvature at
 * each edge's mid-latitude. Both describe the boundary as published, at that
 * release's own generalisation, and neither is a published land-area
 * statistic: a clipped coastline still encloses inland water.
 */
export const areaMetrics = (
	geometry: GeoJsonGeometry,
): AreaMetrics | undefined => {
	const polygons = polygonsOf(geometry);
	const boundingBox = geometryBounds(geometry);
	if (polygons.length === 0 || !boundingBox) return undefined;
	const centroid = centroidOf(polygons);
	if (!centroid) return undefined;
	const inside = containPoint(centroid, geometry) !== "outside";
	const span = inside ? undefined : interiorSpan(polygons, boundingBox);
	const areaM2 = polygons.reduce(
		(total, polygon) => total + polygonAreaM2(polygon),
		0,
	);
	const perimeterM = polygons.reduce(
		(total, polygon) => total + polygonPerimeterM(polygon),
		0,
	);
	return {
		boundingBox,
		centroid,
		labelPoint: span ?? centroid,
		labelPointMethod: span ? "interior-span" : "centroid",
		areaM2,
		areaHectares: areaM2 / 10_000,
		areaKm2: areaM2 / 1_000_000,
		perimeterM,
		perimeterKm: perimeterM / 1000,
		parts: polygons.length,
		rings: polygons.reduce((total, polygon) => total + polygon.length, 0),
		vertices: polygons.reduce(
			(total, polygon) =>
				total + polygon.reduce((count, ring) => count + ring.length, 0),
			0,
		),
	};
};
