import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { energyConsumptionSeries } from "@uk-data-atlas/datasets";
import { compileEnergyConsumption } from "../../src/catalog/energyConsumption.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { fixtureRows } from "./rowFixtures.ts";

test("generates energy observations with declared series keys and matching hashes", () => {
	const manifest = {
		manifestPath: "manifest.json",
		datasets: [{ id: "electricity-consumption" }, { id: "gas-consumption" }],
	} as CatalogManifest;
	const rows = fixtureRows(
		energyConsumptionSeries().map((series) => ({
			dataset: series.measure,
			measure: series.measure,
			geography: "localAuthority",
			release: "2025-uk-bfc",
			members: series.dimensions,
			periods: { "2023": { E08000001: 12 } },
		})),
	);
	const result = compileEnergyConsumption(manifest, rows);
	const expected = energyConsumptionSeries().map(measureSeriesKey);
	expect(result.artifacts.map((artifact) => artifact.measureId)).toEqual(
		expected,
	);
	expect(
		result.artifacts.map((artifact) =>
			result.observationDatasets.get(artifact),
		),
	).toEqual(result.measures.map((measure) => measure.sources[0]!.datasetId));
	for (const { contentHash, ...content } of result.artifacts)
		expect(contentHash).toBe(sha256(JSON.stringify(content)));
});
