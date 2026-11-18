import assert from "node:assert/strict";
import { test } from "vitest";
import { measureQuality } from "@uk-data-atlas/catalogue/node";
import {
	measureSeriesSourceKey,
	registerSeriesObservations,
} from "@uk-data-atlas/measures";
import {
	dataCatalog,
	measureCompatibilityInventory,
	measureObservations,
} from "./routeFixtures";

test("reports a measure quality matrix before querying its observations", () => {
	const identity = { measure: "small-area-fixture" };
	const measure = dataCatalog.measures.find(
		(entry) => entry.id === "small-area-fixture",
	)!;
	const catalog = {
		...dataCatalog,
		measures: dataCatalog.measures.map((entry) =>
			entry === measure ? { ...entry, series: identity } : entry,
		),
	};
	const artifact = measureObservations[0]!;
	const observations = [artifact];
	registerSeriesObservations(
		observations,
		new Map([
			[measureSeriesSourceKey(identity, measure.sources[0]!), artifact],
		]),
	);
	const data = measureQuality(
		catalog,
		measureCompatibilityInventory,
		"small-area-fixture",
		{ measureObservations: observations },
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

test("uses the canonical series index when reporting quality", () => {
	const identity = { measure: "fixture", dimensions: { kind: "total" } };
	const original = dataCatalog.measures.find(
		(measure) => measure.id === "small-area-fixture",
	)!;
	const catalog = {
		...dataCatalog,
		measures: dataCatalog.measures.map((measure) =>
			measure === original ? { ...measure, series: identity } : measure,
		),
	};
	const artifact = { ...measureObservations[0]!, measureId: "different-id" };
	const observations = [artifact];
	registerSeriesObservations(
		observations,
		new Map([
			[measureSeriesSourceKey(identity, original.sources[0]!), artifact],
		]),
	);
	const data = measureQuality(
		catalog,
		measureCompatibilityInventory,
		original.id,
		{ measureObservations: observations },
	);
	assert.equal(
		data?.sources[0]?.periods[0]?.contentHash,
		artifact.contentHash,
	);
});
