import assert from "node:assert/strict";
import { test } from "vitest";
import type { DataCatalog } from "@uk-data-atlas/measures";
import { catalogueWithSeries } from "../src/catalog/catalogueSeries";

test("publishes series identities in the catalogue and includes them in its hash", () => {
	const catalog = {
		schemaVersion: 1,
		contentHash: "old",
		source: { artifact: "manifest", manifestVersion: 1 },
		datasets: [],
		measures: [{ id: "legacy" }],
	} as unknown as DataCatalog;
	const owned = { measure: "households", dimensions: { tenure: "owned" } };
	const result = catalogueWithSeries(catalog, { legacy: owned });
	assert.deepEqual(result.measures[0]?.series, owned);
	assert.equal(catalog.measures[0]?.series, undefined);
	assert.notEqual(result.contentHash, "old");
	assert.notEqual(
		result.contentHash,
		catalogueWithSeries(catalog, {
			legacy: { ...owned, dimensions: { tenure: "rented" } },
		}).contentHash,
	);
	assert.throws(
		() => catalogueWithSeries(catalog, {}),
		/Missing series identity for legacy/,
	);
});
