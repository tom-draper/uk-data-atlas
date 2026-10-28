import assert from "node:assert/strict";
import test from "node:test";
import { measureQuality } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	dataCatalog,
	measureCompatibilityInventory,
	measureObservations,
} from "./routeFixtures";

test("reports a measure quality matrix before querying its observations", () => {
	const data = measureQuality(
		dataCatalog,
		measureCompatibilityInventory,
		"small-area-fixture",
		{ measureObservations },
	);
	assert.ok(data);
	assert.deepEqual(data.measure.id, "small-area-fixture");
	assert.deepEqual(data.sources[0]?.periods, [
		{
			period: "2019",
			artifact: "small-area-fixture-observations",
			contentHash: "sha256:small-area-observations",
			recordCount: 2,
			statusCounts: { observed: 2 },
		},
	]);
});

test("reports missing observations and unknown measures", () => {
	const data = measureQuality(
		dataCatalog,
		measureCompatibilityInventory,
		"small-area-fixture",
		{},
	);
	assert.ok(data);
	assert.deepEqual(data.sources[0]?.periods, [
		{ period: "2019", status: "not-published" },
	]);
	assert.equal(
		measureQuality(
			dataCatalog,
			measureCompatibilityInventory,
			"missing",
			{},
		),
		undefined,
	);
});
