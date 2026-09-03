// Geometry helpers for building the gazetteer at build time.
import { polygonAreaSqKm } from "../../helpers/population";

type Geom = GeoJSON.Geometry;

export function outerRings(geom: Geom): number[][][] {
	if (geom.type === "Polygon") return [geom.coordinates[0]];
	if (geom.type === "MultiPolygon") return geom.coordinates.map((p) => p[0]);
	return [];
}

export function bboxOf(geom: Geom): [number, number, number, number] {
	let minX = 180,
		minY = 90,
		maxX = -180,
		maxY = -90;
	for (const ring of outerRings(geom))
		for (const [x, y] of ring) {
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
	return [minX, minY, maxX, maxY];
}

// Vertex centroid of the largest outer ring. Good enough for point-in-area
// assignment of small building blocks.
export function centroidOf(geom: Geom): [number, number] {
	let best: number[][] = [],
		bestLen = -1;
	for (const ring of outerRings(geom))
		if (ring.length > bestLen) {
			best = ring;
			bestLen = ring.length;
		}
	if (best.length === 0) return [0, 0];
	let sx = 0,
		sy = 0;
	for (const [x, y] of best) {
		sx += x;
		sy += y;
	}
	return [sx / best.length, sy / best.length];
}

export const areaM2 = (geom: Geom): number =>
	Math.round(
		polygonAreaSqKm(
			(geom as { coordinates: number[][][] | number[][][][] })
				.coordinates,
		) * 1e6,
	);

export const inBox = (px: number, py: number, b: readonly number[]): boolean =>
	px >= b[0] && px <= b[2] && py >= b[1] && py <= b[3];

function pointInRing(px: number, py: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][0],
			yi = ring[i][1],
			xj = ring[j][0],
			yj = ring[j][1];
		if (
			yi > py !== yj > py &&
			px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
		)
			inside = !inside;
	}
	return inside;
}

export function pointInGeom(px: number, py: number, geom: Geom): boolean {
	for (const ring of outerRings(geom))
		if (pointInRing(px, py, ring)) return true;
	return false;
}
