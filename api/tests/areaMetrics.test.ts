import assert from "node:assert/strict";
import test from "node:test";
import { projectEqualArea, unprojectEqualArea } from "../src/areaOverlap";
import { areaMetrics } from "../src/areaMetrics";
import type { GeoJsonGeometry } from "../src/areaGeometry";
import { containPoint } from "../src/areaContainment";

const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);

/**
 * The exact area of a lat/lon cell on the ellipsoid, from the closed form for
 * the authalic integral. Independent of the projection under test: it shares
 * only the ellipsoid's own constants.
 */
const cellAreaM2 = (
	southLatitude: number,
	northLatitude: number,
	degreesOfLongitude: number,
) => {
	const q = (latitude: number) => {
		const sinLat = Math.sin((latitude * Math.PI) / 180);
		const e = Math.sqrt(E2);
		return (
			(1 - E2) *
			(sinLat / (1 - E2 * sinLat * sinLat) -
				(1 / (2 * e)) * Math.log((1 - e * sinLat) / (1 + e * sinLat)))
		);
	};
	return (
		((A * A * ((degreesOfLongitude * Math.PI) / 180)) / 2) *
		(q(northLatitude) - q(southLatitude))
	);
};

const ring = (west: number, south: number, east: number, north: number) => [
	[west, south],
	[east, south],
	[east, north],
	[west, north],
	[west, south],
];

const cell = (
	west: number,
	south: number,
	east: number,
	north: number,
): GeoJsonGeometry => ({
	type: "Polygon",
	coordinates: [ring(west, south, east, north)],
});

test("inverts the equal-area projection across the United Kingdom", () => {
	let worstMetres = 0;
	for (let latitude = 49; latitude <= 61; latitude += 0.25) {
		for (let longitude = -8; longitude <= 2; longitude += 1) {
			const [x, y] = projectEqualArea([longitude, latitude]);
			const [backLongitude, backLatitude] = unprojectEqualArea([x, y]);
			worstMetres = Math.max(
				worstMetres,
				Math.abs(backLatitude - latitude) * 111_320,
				Math.abs(backLongitude - longitude) * 70_000,
			);
		}
	}
	// A micrometre over a country-sized sweep: the inversion is exact to the
	// limits of the arithmetic, not merely close.
	assert.ok(
		worstMetres < 1e-6,
		`round trip drifted by ${worstMetres} metres`,
	);
});

test("measures a graticule cell to its exact ellipsoidal area", () => {
	for (const [south, north] of [
		[50, 51],
		[54, 55],
		[58, 59],
	]) {
		const metrics = areaMetrics(cell(-2, south!, -1, north!))!;
		const exact = cellAreaM2(south!, north!, 1);
		const relative = Math.abs(metrics.areaM2 - exact) / exact;
		assert.ok(
			relative < 1e-12,
			`${south}-${north} out by ${relative.toExponential(2)}`,
		);
	}
});

test("centres a rectangle on itself and calls the centroid its label", () => {
	const metrics = areaMetrics(cell(-2, 54, -1, 55))!;
	assert.equal(metrics.labelPointMethod, "centroid");
	assert.deepEqual(metrics.labelPoint, metrics.centroid);
	assert.ok(Math.abs(metrics.centroid[0] - -1.5) < 1e-9);
	// North of the midpoint by a few hundred metres: on the ellipsoid the
	// northern half of a cell is the smaller, so the centre of area sits south
	// of 54.5 rather than on it.
	assert.ok(
		metrics.centroid[1] > 54.49 && metrics.centroid[1] < 54.5,
		`centroid latitude ${metrics.centroid[1]}`,
	);
	assert.deepEqual(metrics.boundingBox, [-2, 54, -1, 55]);
	assert.equal(metrics.parts, 1);
	assert.equal(metrics.rings, 1);
});

test("reports area in three units from one figure", () => {
	const metrics = areaMetrics(cell(-2, 54, -1, 55))!;
	assert.equal(metrics.areaHectares, metrics.areaM2 / 10_000);
	assert.equal(metrics.areaKm2, metrics.areaM2 / 1_000_000);
	assert.equal(metrics.perimeterKm, metrics.perimeterM / 1000);
});

test("subtracts a hole from the area and keeps the centroid on the ring", () => {
	const withHole: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [
			[
				[-2, 54],
				[-1, 54],
				[-1, 55],
				[-2, 55],
				[-2, 54],
			],
			[
				[-1.75, 54.25],
				[-1.25, 54.25],
				[-1.25, 54.75],
				[-1.75, 54.75],
				[-1.75, 54.25],
			],
		],
	};
	const solid = areaMetrics(cell(-2, 54, -1, 55))!;
	const hole = areaMetrics(cell(-1.75, 54.25, -1.25, 54.75))!;
	const metrics = areaMetrics(withHole)!;
	assert.ok(Math.abs(metrics.areaM2 - (solid.areaM2 - hole.areaM2)) < 1);
	assert.equal(metrics.rings, 2);
	// The hole is concentric, so the centre of area does not move, but it now
	// lies in the hole and cannot be the label point.
	assert.ok(Math.abs(metrics.centroid[0] - solid.centroid[0]) < 1e-6);
	assert.equal(metrics.labelPointMethod, "interior-span");
});

test("puts a label point inside a crescent whose centroid escapes it", () => {
	// A C shape opening east: the centre of area falls in the mouth.
	const crescent: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [
			[
				[-2, 54],
				[-1, 54],
				[-1, 54.2],
				[-1.8, 54.2],
				[-1.8, 54.8],
				[-1, 54.8],
				[-1, 55],
				[-2, 55],
				[-2, 54],
			],
		],
	};
	const metrics = areaMetrics(crescent)!;
	// The centroid is genuinely outside, which is what forces the fallback.
	assert.equal(containPoint(metrics.centroid, crescent), "outside");
	assert.equal(metrics.labelPointMethod, "interior-span");
	// Whichever arm it lands in, the point must be in the shape. That is the
	// whole promise of a label point, and the only thing worth asserting: the
	// widest run happens to be an arm of the C rather than its spine.
	assert.notEqual(containPoint(metrics.labelPoint, crescent), "outside");
});

test("adds the parts of a multipolygon and counts them", () => {
	const islands: GeoJsonGeometry = {
		type: "MultiPolygon",
		coordinates: [[ring(-2, 54, -1, 55)], [ring(2, 54, 3, 55)]],
	};
	const one = areaMetrics(cell(-2, 54, -1, 55))!;
	const metrics = areaMetrics(islands)!;
	assert.ok(Math.abs(metrics.areaM2 - 2 * one.areaM2) < 1);
	assert.equal(metrics.parts, 2);
	// Two equal parts either side of the prime meridian centre between them,
	// where there is no land, so the label point must be moved into one.
	assert.equal(metrics.labelPointMethod, "interior-span");
	assert.equal(metrics.boundingBox[0], -2);
	assert.equal(metrics.boundingBox[2], 3);
});

test("flattens a geometry collection into its polygons", () => {
	const collection: GeoJsonGeometry = {
		type: "GeometryCollection",
		geometries: [cell(-2, 54, -1, 55), cell(2, 54, 3, 55)],
	};
	const one = areaMetrics(cell(-2, 54, -1, 55))!;
	const metrics = areaMetrics(collection)!;
	assert.equal(metrics.parts, 2);
	assert.ok(Math.abs(metrics.areaM2 - 2 * one.areaM2) < 1);
});

test("measures the same area whichever way a ring is wound", () => {
	const clockwise = areaMetrics(cell(-2, 54, -1, 55))!;
	const reversed: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [
			[
				[-2, 54],
				[-2, 55],
				[-1, 55],
				[-1, 54],
				[-2, 54],
			],
		],
	};
	const anticlockwise = areaMetrics(reversed)!;
	assert.ok(Math.abs(clockwise.areaM2 - anticlockwise.areaM2) < 1e-6);
	assert.ok(
		Math.abs(clockwise.centroid[1] - anticlockwise.centroid[1]) < 1e-12,
	);
});

test("returns nothing for geometry carrying no polygon", () => {
	assert.equal(
		areaMetrics({ type: "Point", coordinates: [-1, 54] }),
		undefined,
	);
	assert.equal(
		areaMetrics({ type: "GeometryCollection", geometries: [] }),
		undefined,
	);
});
