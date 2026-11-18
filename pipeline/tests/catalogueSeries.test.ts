import assert from "node:assert/strict";
import { test } from "vitest";
import type { DataCatalog } from "@uk-data-atlas/measures";
import { catalogueWithSeries } from "../src/catalog/catalogueSeries";

const catalogueOf = (measures: unknown[]) =>
	({
		schemaVersion: 1,
		contentHash: "old",
		source: { artifact: "manifest", manifestVersion: 1 },
		datasets: [],
		measures,
	}) as unknown as DataCatalog;

test("publishes series identities in the catalogue and includes them in its hash", () => {
	const owned = { measure: "households", dimensions: { tenure: "owned" } };
	const catalog = catalogueOf([{ id: "owned", series: owned }]);
	const result = catalogueWithSeries(catalog);
	assert.deepEqual(result.measures[0]?.series, owned);
	assert.notEqual(result.contentHash, "old");
	assert.notEqual(
		result.contentHash,
		catalogueWithSeries(
			catalogueOf([
				{
					id: "owned",
					series: { ...owned, dimensions: { tenure: "rented" } },
				},
			]),
		).contentHash,
	);
});

test("a measure with no declared series serves the measure of its own id", () => {
	const result = catalogueWithSeries(catalogueOf([{ id: "population" }]));
	assert.deepEqual(result.measures[0]?.series, { measure: "population" });
});

test("writes the series after the other measure fields", () => {
	const result = catalogueWithSeries(
		catalogueOf([
			{ id: "owned", series: { measure: "a" }, label: "Owned" },
		]),
	);
	assert.deepEqual(Object.keys(result.measures[0]!), [
		"id",
		"label",
		"series",
	]);
});

test("publishes the canonical identity of a weight measure", () => {
	const weight = { measure: "population", dimensions: { age: "all" } };
	const result = catalogueWithSeries(
		catalogueOf([
			{
				id: "average",
				aggregation: {
					kind: "intensive",
					weight: { measureId: "legacy-weight" },
				},
			},
			{ id: "legacy-weight", series: weight },
		]),
	);
	assert.deepEqual(result.measures[0]?.weightSeries, weight);
});
