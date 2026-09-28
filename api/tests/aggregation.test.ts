import assert from "node:assert/strict";
import test from "node:test";
import { assessCoverage, summariseCoverage } from "../src/aggregation";

test("counts the expected areas an aggregate did not include", () => {
	assert.deepEqual(
		assessCoverage(
			"2025-05-uk",
			["E05000003", "E05000001", "E05000002", "E05000001"],
			new Set(["E05000001", "W05000001"]),
		),
		{
			boundaryRelease: "2025-05-uk",
			status: "partial",
			expectedAreaCount: 3,
			includedAreaCount: 1,
			missingAreaCount: 2,
			missingAreaSample: ["E05000002", "E05000003"],
		},
	);
});

test("calls an aggregate partial when any compared release expects more", () => {
	const complete = assessCoverage("a", ["E1"], new Set(["E1"]));
	const partial = assessCoverage("b", ["E1", "E2"], new Set(["E1"]));
	assert.deepEqual(summariseCoverage([complete], "unused"), {
		status: "complete",
		assessments: [complete],
	});
	assert.deepEqual(summariseCoverage([complete, partial], "unused"), {
		status: "partial",
		code: "partial_coverage",
		assessments: [complete, partial],
	});
	assert.deepEqual(summariseCoverage([], "No release was assessed."), {
		status: "not-assessed",
		reason: "No release was assessed.",
	});
});
