import assert from "node:assert/strict";
import test from "node:test";
import { calculateWeightedMean } from "../src/weightedMean";

test("calculates a weighted mean after aligning area codes", () => {
	assert.deepEqual(
		calculateWeightedMean(
			[
				{ areaCode: "A", value: 10 },
				{ areaCode: "B", value: 20 },
			],
			[
				{ areaCode: "A", value: 1 },
				{ areaCode: "B", value: 3 },
			],
		),
		{ kind: "ok", value: 17.5, totalWeight: 4 },
	);
});

test("refuses missing areas and invalid weights", () => {
	assert.deepEqual(
		calculateWeightedMean([{ areaCode: "A", value: 10 }], []),
		{ kind: "partial_coverage" },
	);
	assert.deepEqual(
		calculateWeightedMean(
			[{ areaCode: "A", value: 10 }],
			[{ areaCode: "A", value: 0 }],
		),
		{ kind: "invalid_weights" },
	);
});
