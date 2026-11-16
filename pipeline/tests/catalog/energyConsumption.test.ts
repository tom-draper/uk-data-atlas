import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { energyConsumptionSeries } from "@uk-data-atlas/datasets";
import { compileEnergyConsumption } from "../../src/catalog/energyConsumption.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("generates energy observations with declared series keys and matching hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "energy-series-"));
	try {
		const path = join(directory, "source.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2023": {
					year: 2023,
					boundaryYear: 2025,
					boundaryType: "localAuthority",
					data: {
						E08000001: {
							allMetersGwh: 12,
							domesticGwh: 5,
							nonDomesticGwh: 7,
						},
					},
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [
				{ id: "electricity-consumption" },
				{ id: "gas-consumption" },
			],
		} as CatalogManifest;
		const result = compileEnergyConsumption(manifest, {
			"electricity-consumption": path,
			"gas-consumption": path,
		});
		const expected = energyConsumptionSeries().map(measureSeriesKey);
		expect(result.artifacts.map((artifact) => artifact.measureId)).toEqual(
			expected,
		);
		for (const { contentHash, ...content } of result.artifacts)
			expect(contentHash).toBe(sha256(JSON.stringify(content)));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
