import assert from "node:assert/strict";
import { test } from "node:test";
import { classify } from "./classify.mjs";

const square = (size: number) => ({
	type: "Polygon",
	coordinates: [
		[
			[0, 0],
			[size, 0],
			[size, size],
			[0, size],
			[0, 0],
		],
	],
});
const large = square(0.1);
const small = square(0.00001);
const band = square(0.002);
const adapter = { sliverWidthM: 100 };

test("classifies slivers, ordinary overlaps and the indeterminate band", () => {
	assert.equal(classify(adapter, "a", "b", small).keep, false);
	assert.equal(classify(adapter, "a", "b", large).keep, true);
	const uncertain = classify(adapter, "a", "b", band);
	assert.equal(uncertain.indeterminate, true);
	assert.equal(uncertain.unresolved, true);
	assert.equal(
		classify(
			{
				...adapter,
				indeterminatePairs: { decision: "overlap", reason: "reviewed" },
			},
			"a",
			"b",
			band,
		).keep,
		true,
	);
});

test("applies reviewed pairs and reports misplaced inclusions", () => {
	assert.equal(
		classify(
			{ ...adapter, excludedPairs: { a: { b: "reviewed" } } },
			"a",
			"b",
			large,
		).keep,
		false,
	);
	const included = { ...adapter, includedPairs: { a: { b: "reviewed" } } };
	assert.equal(classify(included, "a", "b", band).keep, true);
	assert.equal(classify(included, "a", "b", small).includedOutsideBand, true);
});
