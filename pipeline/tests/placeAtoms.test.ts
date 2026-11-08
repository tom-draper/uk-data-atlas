import assert from "node:assert/strict";
import { test } from "vitest";
import type { GeoJsonGeometry } from "@uk-data-atlas/atlas-runtime/geometry";
import { placeAtoms } from "../src/crosswalk-weights/placement";

const square = (west: number, south: number, east: number, north: number) =>
	({
		type: "Polygon",
		coordinates: [
			[
				[west, south],
				[east, south],
				[east, north],
				[west, north],
				[west, south],
			],
		],
	}) as GeoJsonGeometry;

const shapes: Record<string, GeoJsonGeometry> = {
	// North is drawn without the hole that South sits in.
	North: square(0, 0, 10, 10),
	South: square(4, 4, 6, 6),
	// East overlaps North without nesting in it.
	East: square(8, 2, 14, 8),
	Far: square(20, 20, 22, 22),
};
const place = (points: Array<[number, number]>) =>
	placeAtoms(
		Float64Array.from(points.map(([x]) => x)),
		Float64Array.from(points.map(([, y]) => y)),
		Object.keys(shapes),
		(code) => shapes[code],
	);

test("a point is placed in the area containing it, or nowhere", () => {
	const { codes, area } = place([
		[1, 1],
		[21, 21],
		[50, 50],
	]);
	assert.deepEqual(
		[...area].map((at) => (at >= 0 ? codes[at] : at)),
		["North", "Far", -1],
	);
});

test("a point in an enclave drawn inside another area is placed in the enclave", () => {
	const { codes, area } = place([
		[5, 5],
		[1, 5],
	]);
	assert.deepEqual(
		[...area].map((at) => (at >= 0 ? codes[at] : at)),
		["South", "North"],
	);
});

test("a point in areas that overlap without nesting, or on a border, is placed nowhere", () => {
	const { area } = place([
		[9, 5],
		[4, 5],
	]);
	// 9,5 is in North and East; 4,5 is on South's border and inside North.
	assert.deepEqual([...area], [-2, -2]);
});
