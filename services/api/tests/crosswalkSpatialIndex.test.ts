import assert from "node:assert/strict";
import test from "node:test";
import { CrosswalkSpatialIndex } from "../src/crosswalkSpatialIndex";
import {
	boundsIntersect,
	type Bounds,
} from "@uk-data-atlas/geography/area-geometry-pieces";

test("finds touching and multi-cell candidates once, in input order", () => {
	const index = new CrosswalkSpatialIndex([
		{ value: "wide", bounds: [-1, -1, 1, 1] },
		{ value: "away", bounds: [2, 2, 3, 3] },
		{ value: "edge", bounds: [0.25, 0.25, 0.5, 0.5] },
		{ value: "negative", bounds: [-0.5, -0.5, 0, 0] },
	]);
	assert.deepEqual(index.query([0, 0, 0.25, 0.25]), [
		"wide",
		"edge",
		"negative",
	]);
	assert.deepEqual(index.query([10, 10, 11, 11]), []);
});

test("matches exhaustive search for local, broad and empty envelopes", () => {
	const entries = Array.from({ length: 500 }, (_, value) => ({
		value,
		bounds: [
			(value % 30) - 15,
			Math.floor(value / 30) - 8,
			(value % 30) - 14.7,
			Math.floor(value / 30) - 7.7,
		] satisfies Bounds,
	}));
	entries.push({ value: 500, bounds: [-180, -90, 180, 90] });
	entries.push({
		value: 501,
		bounds: [Infinity, Infinity, -Infinity, -Infinity],
	});
	const index = new CrosswalkSpatialIndex(entries);
	const queries: Bounds[] = [
		[-180, -90, 180, 90],
		[Infinity, Infinity, -Infinity, -Infinity],
		...entries.slice(0, 500).map(({ bounds }) => bounds),
	];
	for (const bounds of queries)
		assert.deepEqual(
			index.query(bounds),
			entries
				.filter((entry) => boundsIntersect(bounds, entry.bounds))
				.map(({ value }) => value),
		);
});
