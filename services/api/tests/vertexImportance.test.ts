import assert from "node:assert/strict";
import test from "node:test";
import { unprojectEqualArea } from "../src/equalAreaProjection";
import { vertexImportance } from "../src/simplifyGeometry";

const points = [
	[0, 0],
	[10, 4],
	[20, 0],
	[25, 9],
	[30, 0],
	[40, 2],
	[50, 0],
].map(([x, y]) => unprojectEqualArea([x!, y! + 5_000_000]));

test("selects the original open-arc survivors at every threshold", () => {
	const importance = vertexImportance(points, false, 1000);
	for (const [threshold, expected] of [
		[0, [0, 1, 2, 3, 4, 5, 6]],
		[20, [0, 1, 2, 3, 4, 5, 6]],
		[40, [0, 1, 2, 3, 4, 6]],
		[50, [0, 6]],
		[1000, [0, 6]],
	] satisfies Array<[number, number[]]>) {
		assert.deepEqual(
			points.flatMap((_, index) =>
				importance[index]! >= threshold ? [index] : [],
			),
			expected,
		);
	}
	assert.deepEqual(
		Array.from(vertexImportance(points, false, 40), (area) =>
			Number(area < 40),
		),
		[0, 0, 0, 0, 0, 1, 0],
	);
});

test("keeps a triangle in closed arcs and supports finer refinement queries", () => {
	const importance = vertexImportance(points, true, 1000);
	for (const [threshold, expected] of [
		[0, [0, 1, 2, 3, 4, 5, 6]],
		[40, [0, 1, 2, 3, 4]],
		[50, [2, 3, 4]],
		[1000, [2, 3, 4]],
	] satisfies Array<[number, number[]]>) {
		assert.deepEqual(
			points.flatMap((_, index) =>
				importance[index]! >= threshold ? [index] : [],
			),
			expected,
		);
	}
	assert.deepEqual(
		Array.from(vertexImportance(points, true, 50), (area) =>
			Number(area < 50),
		),
		[1, 1, 0, 0, 0, 1, 1],
	);
});

test("keeps vertices exactly at the threshold and preserves short arcs", () => {
	const arc = points.slice(0, 3);
	const importance = vertexImportance(arc, false, 1000);
	const threshold = importance[1]!;
	assert.ok(Number.isFinite(threshold));
	assert.deepEqual(
		Array.from(vertexImportance(arc, false, threshold), (area) =>
			Number(area < threshold),
		),
		[0, 0, 0],
	);
	assert.deepEqual(
		Array.from(vertexImportance(arc, false, threshold + 1), (area) =>
			Number(area < threshold + 1),
		),
		[0, 1, 0],
	);
	assert.deepEqual(
		Array.from(vertexImportance(points.slice(0, 2), false, 1000)),
		[Infinity, Infinity],
	);
	assert.deepEqual(
		Array.from(vertexImportance(points.slice(0, 3), true, 1000)),
		[Infinity, Infinity, Infinity],
	);
	assert.deepEqual(Array.from(vertexImportance([], true, 1000)), []);
});
