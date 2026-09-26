import assert from "node:assert/strict";
import test from "node:test";
import {
	GEOMETRY_TIERS,
	isGeometryTier,
	simplifyGeometry,
} from "../src/simplifyGeometry";
import { areaMetrics } from "../src/areaMetrics";
import type { GeoJsonGeometry } from "../src/areaGeometry";

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

/** A square whose southern edge carries many nearly-collinear vertices. */
const noisyCell = (wobbleDegrees: number, steps = 200): GeoJsonGeometry => {
	const south: number[][] = [];
	for (let i = 0; i <= steps; i += 1) {
		const longitude = -2 + i / steps;
		// Alternating: every other vertex is a spike of the given size.
		south.push([longitude, 54 + (i % 2 === 0 ? 0 : wobbleDegrees)]);
	}
	return {
		type: "Polygon",
		coordinates: [[...south, [-1, 55], [-2, 55], [-2, 54]]],
	};
};

test("names its tiers and rejects anything else", () => {
	assert.deepEqual(Object.keys(GEOMETRY_TIERS), [
		"full",
		"high",
		"medium",
		"low",
	]);
	assert.equal(isGeometryTier("medium"), true);
	assert.equal(isGeometryTier("coarse"), false);
	assert.equal(isGeometryTier("constructor"), false);
});

test("returns the geometry untouched at the full tier", () => {
	const geometry = noisyCell(0.001);
	const result = simplifyGeometry(geometry, "full")!;
	assert.equal(result.geometry, geometry);
	assert.equal(result.toleranceM, 0);
	assert.equal(result.verticesAfter, result.verticesBefore);
});

test("drops detail below the tolerance and keeps what is above it", () => {
	// A 0.001 degree spike is about 110 m, so medium (100 m) must keep it and
	// low (1000 m) must not.
	const geometry = noisyCell(0.001);
	const medium = simplifyGeometry(geometry, "medium")!;
	const low = simplifyGeometry(geometry, "low")!;
	assert.ok(
		medium.verticesAfter > low.verticesAfter,
		`medium ${medium.verticesAfter} should keep more than low ${low.verticesAfter}`,
	);
	// The coarse tier takes a 204-vertex ring down to a handful. It does not
	// reach the four corners: by the time the survivors are 20 km apart, the
	// 110 m spike between them spans 1.1 km2 and clears the 1 km2 threshold.
	// That is the area rule working, not the tolerance failing.
	assert.ok(
		low.verticesAfter < 20,
		`low kept ${low.verticesAfter} of ${low.verticesBefore}`,
	);
	assert.equal(low.minEffectiveAreaM2, 1_000_000);
});

test("simplifies monotonically as the tier coarsens", () => {
	const geometry = noisyCell(0.0005);
	const counts = (["full", "high", "medium", "low"] as const).map(
		(tier) => simplifyGeometry(geometry, tier)!.verticesAfter,
	);
	for (let i = 1; i < counts.length; i += 1) {
		assert.ok(
			counts[i]! <= counts[i - 1]!,
			`tier ${i} kept ${counts[i]} against ${counts[i - 1]}`,
		);
	}
});

test("never reduces a ring below a closed triangle", () => {
	const geometry = cell(-2, 54, -1, 55);
	const result = simplifyGeometry(geometry, "low")!;
	const coordinates = result.geometry.coordinates as number[][][];
	assert.ok(coordinates[0]!.length >= 4, "ring collapsed");
	// Still closed.
	assert.deepEqual(coordinates[0]!.at(0), coordinates[0]!.at(-1));
});

test("keeps a simplified area close to the original", () => {
	const geometry = noisyCell(0.0005);
	const before = areaMetrics(geometry)!;
	const after = areaMetrics(simplifyGeometry(geometry, "low")!.geometry)!;
	const relative = Math.abs(after.areaM2 - before.areaM2) / before.areaM2;
	assert.ok(relative < 0.01, `area moved by ${relative}`);
});

test("discards a part smaller than the detail being dropped", () => {
	// A large cell and an islet a few metres across.
	const islands: GeoJsonGeometry = {
		type: "MultiPolygon",
		coordinates: [[ring(-2, 54, -1, 55)], [ring(0, 54, 0.00002, 54.00002)]],
	};
	const full = simplifyGeometry(islands, "full")!;
	assert.equal(full.partsAfter, 2);
	const low = simplifyGeometry(islands, "low")!;
	assert.equal(low.partsBefore, 2);
	assert.equal(low.partsAfter, 1);
	// Still a MultiPolygon, though only one part is left: an area keeps the
	// same geometry type at every tier, so a client need not re-branch on the
	// shape of the response when it asks for a coarser one.
	assert.equal(low.geometry.type, "MultiPolygon");
});

test("keeps a hole that is larger than the tolerance", () => {
	const withHole: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [ring(-2, 54, -1, 55), ring(-1.75, 54.25, -1.25, 54.75)],
	};
	const low = simplifyGeometry(withHole, "low")!;
	const coordinates = low.geometry.coordinates as number[][][];
	assert.equal(coordinates.length, 2, "hole was dropped");
});

test("reports nothing when every part falls below the tier", () => {
	const speck: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [ring(0, 54, 0.00002, 54.00002)],
	};
	assert.equal(simplifyGeometry(speck, "low"), undefined);
	// The same speck survives at full resolution, which is the point: absence
	// at a tier means too small to draw, not missing.
	assert.ok(simplifyGeometry(speck, "full"));
});

test("simplifies each geometry in a collection", () => {
	const collection: GeoJsonGeometry = {
		type: "GeometryCollection",
		geometries: [noisyCell(0.0005), cell(2, 54, 3, 55)],
	};
	const low = simplifyGeometry(collection, "low")!;
	assert.equal(low.geometry.type, "GeometryCollection");
	assert.ok(low.verticesAfter < low.verticesBefore);
	assert.equal(low.partsAfter, 2);
});

test("leaves geometry that is not a polygon alone", () => {
	const point: GeoJsonGeometry = { type: "Point", coordinates: [-1, 54] };
	const low = simplifyGeometry(point, "low")!;
	assert.deepEqual(low.geometry, point);
});
