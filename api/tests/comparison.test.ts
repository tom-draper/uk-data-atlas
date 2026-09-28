import assert from "node:assert/strict";
import test from "node:test";
import { compareObservations } from "../src/comparison";
import type { Measure } from "../src/dataCatalog";

const ratioMeasure: Measure = {
	id: "coverage",
	label: "Coverage",
	valueKind: "ratio",
	unit: "%",
	aggregation: {
		kind: "intensive",
		operation: "weighted-mean",
		weight: { description: "premises", datasetField: "premises" },
		available: false,
	},
	sources: [],
	availability: { sourceExact: true, conversion: false, aggregation: false },
	links: { data: "/v1/data/coverage" },
};

test("does not mislabel a ratio difference as relative change", () => {
	const result = compareObservations(
		ratioMeasure,
		{ areaCode: "A", value: 40, status: "observed" },
		{ areaCode: "B", value: 55, status: "observed" },
	);
	assert.equal(result.difference.value, 15);
	assert.match(result.difference.interpretation, /ratio scale/);
	assert.equal(result.relativeDifference, null);
});
