import assert from "node:assert/strict";
import { test } from "vitest";
import { MEASURES, type Measure } from "../../src/crosswalk-weights/atoms";
import {
	weighEdges,
	type Placement,
	type WeighedEdge,
} from "../../src/crosswalk-weights/weigh";

const measures = (population: number[]): Record<Measure, Float64Array> =>
	Object.fromEntries(
		MEASURES.map((name) => [
			name,
			Float64Array.from(
				name === "population" ? population : population.map(() => 1),
			),
		]),
	) as Record<Measure, Float64Array>;

// Four atoms. Atom 3 is in no source area, so only X holds it.
const from: Placement = {
	codes: ["A", "B"],
	area: Int32Array.from([0, 0, 1, -1]),
};
const to: Placement = {
	codes: ["X", "Y"],
	area: Int32Array.from([0, 1, 1, 0]),
};
const edge = (
	fromCode: string,
	toCode: string,
	exact = false,
): WeighedEdge => ({
	fromVersion: fromCode.charCodeAt(0),
	toVersion: toCode.charCodeAt(0),
	fromCode,
	toCode,
	exact,
});
const edges = [
	edge("A", "X"),
	edge("A", "Y"),
	edge("B", "Y", true),
	// No atom lies in both.
	edge("B", "X"),
];

const near = (found: number | undefined, expected: number) =>
	assert.ok(
		found !== undefined && Math.abs(found - expected) < 1e-12,
		`${String(found)} is not ${expected}`,
	);

test("overlap, weight and shares come from the atoms in both areas of an edge", () => {
	const rows = weighEdges(measures([10, 20, 30, 40]), from, to, edges);
	const population = rows.filter((row) => row.basis === "population");
	// B to Y is exact and B to X holds nothing, so neither has a row.
	assert.deepEqual(
		population.map((row) => [row.fromVersion, row.toVersion]),
		[
			[65, 88],
			[65, 89],
		],
	);
	const [ax, ay] = population;
	near(ax!.overlap, 10);
	near(ax!.weight, 10 / 30);
	near(ax!.sourceShare, 10 / 30);
	// X holds atoms 0 and 3, 50 in all.
	near(ax!.targetShare, 10 / 50);
	near(ay!.overlap, 20);
	near(ay!.weight, 20 / 30);
	near(ay!.targetShare, 20 / 50);
	// A's weights sum to 1.
	near(ax!.weight + ay!.weight, 1);
	// Each basis has its own measure.
	const postcodes = rows.filter((row) => row.basis === "postcodes");
	near(postcodes[0]!.weight, 1 / 2);
	near(postcodes[0]!.targetShare, 1 / 2);
});

test("a source's weights sum over all its edges, exact or not", () => {
	const rows = weighEdges(measures([10, 20, 30, 40]), from, to, [
		edge("A", "X", true),
		edge("A", "Y"),
	]);
	const row = rows.find((entry) => entry.basis === "population")!;
	assert.equal(
		rows.filter((entry) => entry.basis === "population").length,
		1,
	);
	near(row.weight, 20 / 30);
});

test("a basis the crosswalk declares itself is left alone", () => {
	const rows = weighEdges(
		measures([10, 20, 30, 40]),
		from,
		to,
		edges,
		new Set(["population"]),
	);
	assert.deepEqual([...new Set(rows.map((row) => row.basis))].sort(), [
		"dwellings",
		"households",
		"postcodes",
	]);
});

test("placements of different atoms are refused", () => {
	assert.throws(
		() =>
			weighEdges(
				measures([1, 2, 3, 4]),
				from,
				{
					codes: ["X"],
					area: Int32Array.from([0]),
				},
				edges,
			),
		/different atoms/,
	);
});
