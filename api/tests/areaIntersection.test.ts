import assert from "node:assert/strict";
import test from "node:test";
import {
	boundsIntersect,
	boundsWithin,
	geometryMeetsBounds,
	type GeometryBounds,
} from "../src/areaContainment";
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

const box = (
	west: number,
	south: number,
	east: number,
	north: number,
): GeometryBounds => [west, south, east, north];

test("settles boxes that overlap, touch and miss", () => {
	assert.equal(boundsIntersect(box(0, 0, 2, 2), box(1, 1, 3, 3)), true);
	assert.equal(boundsIntersect(box(0, 0, 2, 2), box(2, 2, 3, 3)), true);
	assert.equal(boundsIntersect(box(0, 0, 2, 2), box(2.1, 0, 3, 3)), false);
	assert.equal(boundsIntersect(box(0, 0, 2, 2), box(0, 2.1, 3, 3)), false);
});

test("knows when one box sits inside another", () => {
	assert.equal(boundsWithin(box(1, 1, 2, 2), box(0, 0, 3, 3)), true);
	assert.equal(boundsWithin(box(0, 0, 3, 3), box(0, 0, 3, 3)), true);
	assert.equal(boundsWithin(box(0, 0, 3, 3), box(1, 1, 2, 2)), false);
	// Overlapping is not containing.
	assert.equal(boundsWithin(box(1, 1, 4, 4), box(0, 0, 3, 3)), false);
});

test("finds a square that straddles the edge of a box", () => {
	const square = cell(0, 0, 2, 2);
	assert.equal(geometryMeetsBounds(square, box(1, 1, 3, 3)), true);
	assert.equal(geometryMeetsBounds(square, box(-1, -1, 1, 1)), true);
	assert.equal(geometryMeetsBounds(square, box(2.5, 0, 3, 3)), false);
});

test("finds a square wholly inside the box, and a box wholly inside it", () => {
	const square = cell(0, 0, 2, 2);
	// The area inside the box: every edge falls within it.
	assert.equal(geometryMeetsBounds(square, box(-1, -1, 3, 3)), true);
	// The box inside the area: no edge is crossed, so a corner decides.
	assert.equal(geometryMeetsBounds(square, box(0.5, 0.5, 1.5, 1.5)), true);
});

test("keeps a box that sits in a hole out of the answer", () => {
	const withHole: GeoJsonGeometry = {
		type: "Polygon",
		coordinates: [ring(0, 0, 10, 10), ring(3, 3, 7, 7)],
	};
	// Wholly inside the hole: no ring is crossed, and the corner test must
	// read the hole as outside rather than stopping at the outer ring.
	assert.equal(geometryMeetsBounds(withHole, box(4, 4, 6, 6)), false);
	// Straddling the hole's edge does meet the geometry.
	assert.equal(geometryMeetsBounds(withHole, box(6, 6, 8, 8)), true);
	// Well outside the outer ring.
	assert.equal(geometryMeetsBounds(withHole, box(11, 11, 12, 12)), false);
});

test("finds a box crossed by an edge but holding no vertex", () => {
	// A tall thin box lying across the middle of the square, containing none
	// of its corners and contained by none of them either.
	const square = cell(0, 0, 10, 10);
	assert.equal(geometryMeetsBounds(square, box(4, -5, 6, 15)), true);
	assert.equal(geometryMeetsBounds(square, box(-5, 4, 15, 6)), true);
});

test("searches every part of a multipolygon and a collection", () => {
	const islands: GeoJsonGeometry = {
		type: "MultiPolygon",
		coordinates: [[ring(0, 0, 1, 1)], [ring(10, 10, 11, 11)]],
	};
	assert.equal(
		geometryMeetsBounds(islands, box(10.2, 10.2, 10.8, 10.8)),
		true,
	);
	assert.equal(geometryMeetsBounds(islands, box(5, 5, 6, 6)), false);

	const collection: GeoJsonGeometry = {
		type: "GeometryCollection",
		geometries: [cell(0, 0, 1, 1), cell(10, 10, 11, 11)],
	};
	assert.equal(
		geometryMeetsBounds(collection, box(10.2, 10.2, 10.8, 10.8)),
		true,
	);
	assert.equal(geometryMeetsBounds(collection, box(5, 5, 6, 6)), false);
});

test("counts a shared edge as meeting", () => {
	const square = cell(0, 0, 2, 2);
	// The box's western edge lies exactly along the square's eastern one.
	assert.equal(geometryMeetsBounds(square, box(2, 0, 4, 2)), true);
});
