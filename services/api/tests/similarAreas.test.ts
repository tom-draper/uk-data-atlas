import assert from "node:assert/strict";
import { test } from "vitest";
import { similarAreas } from "../src/similarAreas";

test("finds z-score Euclidean neighbours from hand-computed values", () => {
	const result = similarAreas({
		targetAreaCode: "A",
		method: "zscore-euclidean",
		limit: 10,
		measures: [
			{
				id: "first",
				values: [
					{ areaCode: "A", value: 1 },
					{ areaCode: "B", value: 2 },
					{ areaCode: "C", value: 4 },
				],
			},
			{
				id: "second",
				values: [
					{ areaCode: "A", value: 2 },
					{ areaCode: "B", value: 4 },
					{ areaCode: "C", value: 8 },
				],
			},
		],
	});
	assert.deepEqual(result.scaling, [
		{
			measureId: "first",
			mean: 7 / 3,
			standardDeviation: Math.sqrt(14 / 9),
		},
		{
			measureId: "second",
			mean: 14 / 3,
			standardDeviation: Math.sqrt(56 / 9),
		},
	]);
	assert.deepEqual(
		result.areas.map(({ areaCode, rank, values }) => ({
			areaCode,
			rank,
			values,
		})),
		[
			{ areaCode: "B", rank: 1, values: { first: 2, second: 4 } },
			{ areaCode: "C", rank: 2, values: { first: 4, second: 8 } },
		],
	);
	assert.ok(Math.abs(result.areas[0]!.distance - Math.sqrt(9 / 7)) < 1e-12);
});

test("breaks equal distances by area code and excludes the target", () => {
	const result = similarAreas({
		targetAreaCode: "B",
		method: "rank-euclidean",
		limit: 10,
		measures: [
			{
				id: "only",
				values: [
					{ areaCode: "C", value: 2 },
					{ areaCode: "A", value: 2 },
					{ areaCode: "B", value: 1 },
				],
			},
		],
	});
	assert.deepEqual(result.areas, [
		{ areaCode: "A", distance: 1.5, rank: 1, values: { only: 2 } },
		{ areaCode: "C", distance: 1.5, rank: 2, values: { only: 2 } },
	]);
});

test("drops areas missing any selected measure", () => {
	const result = similarAreas({
		targetAreaCode: "A",
		method: "zscore-euclidean",
		limit: 10,
		measures: [
			{
				id: "first",
				values: [
					{ areaCode: "A", value: 1 },
					{ areaCode: "B", value: 2 },
					{ areaCode: "C", value: 3 },
				],
			},
			{
				id: "second",
				values: [
					{ areaCode: "A", value: 1 },
					{ areaCode: "B", value: 2 },
				],
			},
		],
	});
	assert.equal(result.droppedAreaCount, 1);
	assert.deepEqual(
		result.areas.map(({ areaCode }) => areaCode),
		["B"],
	);
});

test("a zero-variance measure contributes no distance", () => {
	const result = similarAreas({
		targetAreaCode: "A",
		method: "zscore-euclidean",
		limit: 10,
		measures: [
			{
				id: "same",
				values: [
					{ areaCode: "A", value: 4 },
					{ areaCode: "B", value: 4 },
				],
			},
		],
	});
	assert.deepEqual(result.scaling, [
		{ measureId: "same", mean: 4, standardDeviation: 0 },
	]);
	assert.deepEqual(result.areas, [
		{ areaCode: "B", distance: 0, rank: 1, values: { same: 4 } },
	]);
});
