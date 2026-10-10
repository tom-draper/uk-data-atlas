import assert from "node:assert/strict";
import test from "node:test";
import {
	borderIndex,
	sharedBorder,
	sharedBorderWith,
} from "../src/areaNeighbours";
import { edgeLengthM } from "../src/equalAreaProjection";
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

const between = (left: GeoJsonGeometry, right: GeoJsonGeometry) =>
	sharedBorder(borderIndex(left), borderIndex(right));

test("measures a whole shared edge", () => {
	// Two cells meeting along the meridian from 54N to 55N.
	const shared = between(cell(-1, 54, 0, 55), cell(0, 54, 1, 55))!;
	assert.equal(shared.touch, "edge");
	assert.equal(shared.sharedEdges, 1);
	assert.equal(shared.sharedVertices, 2);
	// One degree of latitude, measured the same way the perimeter is.
	assert.equal(shared.sharedBorderM, edgeLengthM([0, 54], [0, 55]));
	assert.ok(
		shared.sharedBorderM > 110_000 && shared.sharedBorderM < 112_000,
		`${shared.sharedBorderM} m`,
	);
});

test("calls a corner meeting a corner a point touch", () => {
	// Diagonally placed: they have the vertex at (0, 55) and nothing else.
	const shared = between(cell(-1, 54, 0, 55), cell(0, 55, 1, 56))!;
	assert.equal(shared.touch, "point");
	assert.equal(shared.sharedEdges, 0);
	assert.equal(shared.sharedVertices, 1);
	assert.equal(shared.sharedBorderM, 0);
});

test("reports nothing for areas that do not meet", () => {
	assert.equal(between(cell(-1, 54, 0, 55), cell(5, 54, 6, 55)), undefined);
	// Overlapping bounding boxes are not enough: these two share no vertex.
	assert.equal(
		between(cell(-1, 54, 0, 55), cell(-0.5, 54.5, 0.5, 55.5)),
		undefined,
	);
});

test("adds every stretch of a border broken into several edges", () => {
	const left: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [
			[
				[-1, 54],
				[0, 54],
				[0, 54.5],
				[0, 55],
				[-1, 55],
				[-1, 54],
			],
		],
	};
	const right: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [
			[
				[0, 54],
				[1, 54],
				[1, 55],
				[0, 55],
				[0, 54.5],
				[0, 54],
			],
		],
	};
	const shared = between(left, right)!;
	assert.equal(shared.touch, "edge");
	assert.equal(shared.sharedEdges, 2);
	assert.equal(shared.sharedVertices, 3);
	const expected =
		edgeLengthM([0, 54], [0, 54.5]) + edgeLengthM([0, 54.5], [0, 55]);
	assert.ok(Math.abs(shared.sharedBorderM - expected) < 1e-6);
});

test("counts a shared edge once, not once on each side", () => {
	const shared = between(cell(-1, 54, 0, 55), cell(0, 54, 1, 55))!;
	// Both areas carry this edge; the border is its length, not twice it.
	assert.ok(shared.sharedBorderM < 112_000);
});

test("reads a border the same whichever way the rings are wound", () => {
	const reversed: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [
			[
				[0, 54],
				[0, 55],
				[1, 55],
				[1, 54],
				[0, 54],
			],
		],
	};
	const forward = between(cell(-1, 54, 0, 55), cell(0, 54, 1, 55))!;
	const backward = between(cell(-1, 54, 0, 55), reversed)!;
	assert.equal(backward.touch, "edge");
	assert.equal(backward.sharedEdges, forward.sharedEdges);
	assert.ok(Math.abs(backward.sharedBorderM - forward.sharedBorderM) < 1e-9);
});

test("finds a border on any part of a multipolygon", () => {
	const islands: GeoJsonGeometry = {
		type: "MultiPolygon",
		coordinates: [[ring(-5, 54, -4, 55)], [ring(-1, 54, 0, 55)]],
	};
	const shared = between(islands, cell(0, 54, 1, 55))!;
	assert.equal(shared.touch, "edge");
	assert.equal(shared.sharedEdges, 1);
});

test("finds a border along the inside of a hole", () => {
	const withHole: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [ring(-2, 53, 2, 57), ring(-1, 54, 0, 55)],
	};
	// The enclave filling the hole shares the hole's whole ring.
	const enclave = cell(-1, 54, 0, 55);
	const shared = between(withHole, enclave)!;
	assert.equal(shared.touch, "edge");
	assert.equal(shared.sharedEdges, 4);
	assert.equal(shared.sharedVertices, 4);
});

test("indexes each distinct edge once", () => {
	const index = borderIndex(cell(-1, 54, 0, 55));
	assert.equal(index.edges.size, 4);
	assert.equal(index.vertices.size, 4);
});

test("does not invent a border from two rings starting at one shared corner", () => {
	// Both rings begin at (0, 55), the single vertex they have in common. A
	// closed ring repeats its first point, so each carries a zero-length
	// wrap-around edge there; were those kept, the two would appear to share a
	// border rather than a corner.
	const west: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [
			[
				[0, 55],
				[0, 54],
				[-1, 54],
				[-1, 55],
				[0, 55],
			],
		],
	};
	const northEast: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [
			[
				[0, 55],
				[1, 55],
				[1, 56],
				[0, 56],
				[0, 55],
			],
		],
	};
	const shared = between(west, northEast)!;
	assert.equal(shared.touch, "point");
	assert.equal(shared.sharedEdges, 0);
	assert.equal(shared.sharedVertices, 1);
	assert.equal(shared.sharedBorderM, 0);
});

test("measures a neighbour from its geometry as it does from its whole index", () => {
	const target = cell(-1, 54, 0, 55);
	// A large area with a long coastline of vertices far from the target, and
	// a stretch along the target's east side.
	const coast = Array.from({ length: 200 }, (_, step) => [
		3 + step / 100,
		50 + (step % 7) / 10,
	]);
	const sprawl: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [
			[[0, 54], [0, 54.5], [0, 55], [4, 56], ...coast, [4, 53], [0, 54]],
		],
	};
	const cases: Array<[string, GeoJsonGeometry]> = [
		["a shared edge", cell(0, 54, 1, 55)],
		["a corner", cell(0, 55, 1, 56)],
		["apart", cell(5, 60, 6, 61)],
		["a long area along one side", sprawl],
		[
			"a multipolygon with one island alongside",
			{
				type: "MultiPolygon",
				coordinates: [[ring(-5, 54, -4, 55)], [ring(0, 54, 1, 55)]],
			},
		],
		[
			"a fill of the target's hole",
			{
				type: "Polygon",
				coordinates: [ring(-3, 53, 2, 57), ring(-1, 54, 0, 55)],
			},
		],
	];
	for (const [name, other] of cases) {
		const whole = sharedBorder(borderIndex(target), borderIndex(other));
		const direct = sharedBorderWith(borderIndex(target), other);
		assert.equal(direct?.touch, whole?.touch, name);
		assert.equal(direct?.sharedEdges, whole?.sharedEdges, name);
		assert.equal(direct?.sharedVertices, whole?.sharedVertices, name);
		assert.ok(
			Math.abs(
				(direct?.sharedBorderM ?? 0) - (whole?.sharedBorderM ?? 0),
			) < 1e-6,
			name,
		);
	}
	assert.equal(
		sharedBorderWith(borderIndex(target), cell(5, 60, 6, 61)),
		undefined,
	);
	assert.equal(
		sharedBorderWith(
			borderIndex({ type: "MultiPolygon", coordinates: [] }),
			target,
		),
		undefined,
	);
});
