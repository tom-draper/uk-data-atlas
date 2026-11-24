import type { MultiPolygon, Pair, Polygon, Ring } from "polygon-clipping";

// WGS 84 ellipsoid.
const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const E = Math.sqrt(E2);

// EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global): Lambert cylindrical
// equal-area on the ellipsoid with a 30° standard parallel. Any polygon's
// projected area is its area on the ellipsoid, so areas need no correction.
const K0 =
	Math.cos(Math.PI / 6) / Math.sqrt(1 - E2 * Math.sin(Math.PI / 6) ** 2);

const authalicQ = (sinLat: number) =>
	(1 - E2) *
	(sinLat / (1 - E2 * sinLat * sinLat) -
		(1 / (2 * E)) * Math.log((1 - E * sinLat) / (1 + E * sinLat)));

export const projectEqualArea = ([lon, lat]: Pair): Pair => [
	A * K0 * ((lon * Math.PI) / 180),
	(A * authalicQ(Math.sin((lat * Math.PI) / 180))) / (2 * K0),
];

const authalicQPrime = (sinLat: number) => {
	const w = 1 - E2 * sinLat * sinLat;
	return (1 - E2) * ((1 + E2 * sinLat * sinLat) / (w * w) + 1 / w);
};

/**
 * The inverse of projectEqualArea. Longitude is linear in x and simply
 * divides out; latitude needs authalicQ inverted, which Newton's method does
 * in a handful of steps because the function increases monotonically in
 * sin(latitude) and its derivative never vanishes on the ellipsoid.
 */
export const unprojectEqualArea = ([x, y]: Pair): Pair => {
	const target = (2 * K0 * y) / A;
	let sinLat = Math.max(-1, Math.min(1, target / (1 - E2 / 3)));
	for (let step = 0; step < 12; step += 1) {
		const delta =
			(authalicQ(sinLat) - target) / authalicQPrime(sinLat) || 0;
		sinLat = Math.max(-1, Math.min(1, sinLat - delta));
		if (Math.abs(delta) < 1e-15) break;
	}
	return [
		((x / (A * K0)) * 180) / Math.PI,
		(Math.asin(sinLat) * 180) / Math.PI,
	];
};

const ringAreaM2 = (ring: Ring) => {
	const projected = ring.map(projectEqualArea);
	let twiceArea = 0;
	for (let i = 0, j = projected.length - 1; i < projected.length; j = i++) {
		twiceArea +=
			(projected[j][0] - projected[i][0]) *
			(projected[j][1] + projected[i][1]);
	}
	return Math.abs(twiceArea / 2);
};

export const polygonAreaM2 = ([outer, ...holes]: Polygon) =>
	ringAreaM2(outer) -
	holes.reduce((total, hole) => total + ringAreaM2(hole), 0);

export const multiPolygonAreaM2 = (multiPolygon: MultiPolygon) =>
	multiPolygon.reduce((total, polygon) => total + polygonAreaM2(polygon), 0);

// Ground length of a short edge from the ellipsoid's radii of curvature at
// its mid-latitude. Edges here are metres to a few kilometres long, where
// this agrees with the geodesic to well under a part in a million.
export const edgeLengthM = ([lon1, lat1]: Pair, [lon2, lat2]: Pair) => {
	const sinLat = Math.sin((((lat1 + lat2) / 2) * Math.PI) / 180);
	const w = Math.sqrt(1 - E2 * sinLat * sinLat);
	const meridional = (A * (1 - E2)) / (w * w * w);
	const primeVertical = (A / w) * Math.sqrt(1 - sinLat * sinLat);
	return Math.hypot(
		(((lon2 - lon1) * Math.PI) / 180) * primeVertical,
		(((lat2 - lat1) * Math.PI) / 180) * meridional,
	);
};

const ringPerimeterM = (ring: Ring) => {
	let perimeter = 0;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		perimeter += edgeLengthM(ring[j], ring[i]);
	}
	return perimeter;
};

/** Every ring's ground length, holes included: the boundary drawn on land. */
export const polygonPerimeterM = (polygon: Polygon) =>
	polygon.reduce((total, ring) => total + ringPerimeterM(ring), 0);

/**
 * Twice area over perimeter: the width of a strip with this polygon's area
 * and perimeter. Slivers left where two independently generalised boundaries
 * disagree are metres wide; real overlaps are hundreds of metres or more.
 */
export const polygonWidthM = (polygon: Polygon) => {
	const perimeter = polygonPerimeterM(polygon);
	return perimeter === 0 ? 0 : (2 * polygonAreaM2(polygon)) / perimeter;
};
