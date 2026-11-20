import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileHousePrice } from "../../src/catalog/housePrice.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { fixtureRows } from "./rowFixtures.ts";

const manifest = {
	manifestPath: "manifest.json",
	datasets: [{ id: "house-price" }],
} as CatalogManifest;

test("house price observations use their canonical identity and matching hash", () => {
	const rows = fixtureRows([
		{
			dataset: "house-price",
			measure: "house-price-median",
			geography: "ward",
			release: "2020-uk-bfc",
			periods: { "2022": { E05000001: 150000 } },
		},
	]);
	const {
		artifact: { contentHash, ...artifact },
	} = compileHousePrice(manifest, rows);
	expect(artifact.measureId).toBe(
		measureSeriesKey({ measure: "house-price-median" }),
	);
	expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
});

test("house prices stop at the last full calendar year", () => {
	const rows = fixtureRows([
		{
			dataset: "house-price",
			measure: "house-price-median",
			geography: "ward",
			release: "2020-uk-bfc",
			periods: {
				"2022": { E05000001: 150000 },
				"2023": { E05000001: 160000 },
			},
		},
	]);
	const { measure } = compileHousePrice(manifest, rows);
	expect(measure.sources[0]?.periods).toEqual(["2022"]);
});
