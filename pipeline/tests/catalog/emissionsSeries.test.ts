import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileEmissions } from "../../src/catalog/emissions.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("total emissions observations carry their sector identity and matching hash", () => {
	const directory = mkdtempSync(join(tmpdir(), "emissions-series-"));
	try {
		const path = join(directory, "emissions.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2023": {
					year: 2023,
					boundaryYear: 2025,
					boundaryType: "localAuthority",
					data: { E06000001: { totalKtCO2e: 10 } },
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [
				{
					id: "ghg-emissions",
					summary: {
						dataRecordCount: 1,
						datasetCount: 1,
						boundaryYears: [2025],
					},
				},
			],
		} as CatalogManifest;
		const {
			artifact: { contentHash, ...artifact },
		} = compileEmissions(manifest, path);
		expect(artifact.measureId).toBe(
			measureSeriesKey({
				measure: "ghg-emissions",
				dimensions: { "emissions-sector": "total" },
			}),
		);
		expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
