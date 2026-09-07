import type { BoundaryGeojson } from "@lib/types";
import { getProp } from "./properties";

/**
 * Works out which local authority a ward sits in from the geometry alone.
 *
 * Most ward releases name their local authority in the feature properties, and
 * where they do that is what the mapping is built from. ONS did not publish one
 * for the December 2017 through 2021 wards, though, so those releases carry a
 * ward code and nothing else. A ward with no local authority is invisible to
 * every filtered view — `filterFeatures` keeps a ward only when its authority
 * is one of the location's — so half of a release can silently vanish the
 * moment anywhere but the whole United Kingdom is selected, and a card keyed to
 * it draws nothing at all.
 *
 * Sharing codes across releases covers the wards that still existed later; this
 * covers the rest, by asking which authority actually contains them.
 */

type Ring = number[][];
type Bbox = [number, number, number, number];

/** Ray casting, counting crossings of the ring's edges to the point's west. */
const ringContains = (ring: Ring, x: number, y: number): boolean => {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
};

/** A polygon contains a point when its exterior does and no hole does. */
const polygonContains = (polygon: Ring[], x: number, y: number): boolean => {
	if (polygon.length === 0 || !ringContains(polygon[0], x, y)) return false;
	for (let i = 1; i < polygon.length; i++) {
		if (ringContains(polygon[i], x, y)) return false;
	}
	return true;
};

const polygonsOf = (geometry: unknown): Ring[][] => {
	const geom = geometry as
		| { type: "Polygon"; coordinates: Ring[] }
		| { type: "MultiPolygon"; coordinates: Ring[][] }
		| null;
	if (!geom) return [];
	if (geom.type === "Polygon") return [geom.coordinates];
	if (geom.type === "MultiPolygon") return geom.coordinates;
	return [];
};

const bboxOf = (polygons: Ring[][]): Bbox => {
	let west = Infinity,
		south = Infinity,
		east = -Infinity,
		north = -Infinity;
	for (const polygon of polygons) {
		for (const [x, y] of polygon[0] ?? []) {
			if (x < west) west = x;
			if (x > east) east = x;
			if (y < south) south = y;
			if (y > north) north = y;
		}
	}
	return [west, south, east, north];
};

const bboxesOverlap = (a: Bbox, b: Bbox): boolean =>
	a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/**
 * The points a ward is tested by: the centre of its largest ring, and a spread
 * of that ring's own vertices. A centroid falls outside its own polygon often
 * enough — crescent-shaped and estuary wards especially — that testing it alone
 * would leave real gaps. A vertex sits exactly on the border it shares with the
 * next authority, so each is nudged a little way back towards the centre first.
 */
const probePoints = (polygons: Ring[][]): [number, number][] => {
	let ring: Ring = [];
	for (const polygon of polygons) {
		if ((polygon[0]?.length ?? 0) > ring.length) ring = polygon[0];
	}
	if (ring.length === 0) return [];

	let sumX = 0,
		sumY = 0;
	for (const [x, y] of ring) {
		sumX += x;
		sumY += y;
	}
	const centre: [number, number] = [sumX / ring.length, sumY / ring.length];

	const points: [number, number][] = [centre];
	const step = Math.max(1, Math.floor(ring.length / 8));
	for (let i = 0; i < ring.length; i += step) {
		points.push([
			ring[i][0] + (centre[0] - ring[i][0]) * 0.001,
			ring[i][1] + (centre[1] - ring[i][1]) * 0.001,
		]);
	}
	return points;
};

type Container = { code: string; bbox: Bbox; polygons: Ring[][] };

const indexContainers = (
	features: BoundaryGeojson["features"],
	codeKeys: readonly string[],
): Container[] => {
	const containers: Container[] = [];
	for (const feature of features) {
		const code = feature.properties
			? getProp(feature.properties, codeKeys)
			: undefined;
		if (!code) continue;
		const polygons = polygonsOf(feature.geometry);
		if (polygons.length === 0) continue;
		containers.push({ code, bbox: bboxOf(polygons), polygons });
	}
	return containers;
};

/**
 * Maps each named ward onto the local authority whose boundary contains it.
 * Wards already carrying an authority are not passed in; the caller keeps the
 * published answer wherever there is one.
 */
export const wardLadFromGeometry = (
	wards: BoundaryGeojson["features"],
	wardCodeKeys: readonly string[],
	localAuthorities: BoundaryGeojson["features"],
	localAuthorityCodeKeys: readonly string[],
	needed: (wardCode: string) => boolean,
): Record<string, string> => {
	const containers = indexContainers(
		localAuthorities,
		localAuthorityCodeKeys,
	);
	const resolved: Record<string, string> = {};

	for (const ward of wards) {
		const wardCode = ward.properties
			? getProp(ward.properties, wardCodeKeys)
			: undefined;
		if (!wardCode || !needed(wardCode) || resolved[wardCode]) continue;

		const polygons = polygonsOf(ward.geometry);
		if (polygons.length === 0) continue;
		const wardBbox = bboxOf(polygons);
		const candidates = containers.filter((c) =>
			bboxesOverlap(c.bbox, wardBbox),
		);
		if (candidates.length === 0) continue;

		// Vote across the probe points rather than taking the first hit. These
		// are generalised outlines, so a ward's edge and its authority's edge
		// do not align exactly and a single point near the border can land next
		// door; the authority that claims the most points is the right answer.
		const votes = new Map<string, number>();
		for (const [x, y] of probePoints(polygons)) {
			const hit = candidates.find((c) =>
				c.polygons.some((polygon) => polygonContains(polygon, x, y)),
			);
			if (hit) votes.set(hit.code, (votes.get(hit.code) ?? 0) + 1);
		}
		let best: string | undefined;
		let bestVotes = 0;
		for (const [code, count] of votes) {
			if (count > bestVotes) {
				best = code;
				bestVotes = count;
			}
		}
		if (best) resolved[wardCode] = best;
	}

	return resolved;
};
