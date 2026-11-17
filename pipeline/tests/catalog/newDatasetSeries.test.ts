import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import {
	compileNewDatasets,
	NEW_DATASET_MEASURES,
} from "../../src/catalog/newDatasets.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("new dataset observations use declared series and matching hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "new-dataset-series-"));
	try {
		const path = join(directory, "dataset.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2025": {
					year: 2025,
					boundaryYear: 2025,
					boundaryType: "localAuthority",
					data: { E06000001: { value: 42 } },
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [
				{ id: "waste", summary: { boundaryYears: [2025] } },
				{
					id: "planning-applications",
					summary: { boundaryYears: [2025] },
				},
			],
		} as CatalogManifest;
		const observations = compileNewDatasets(
			manifest,
			NEW_DATASET_MEASURES({ waste: path, planningApplications: path }),
		);
		const expected = new Map([
			["waste", measureSeriesKey({ measure: "collected-waste" })],
			[
				"planning-applications",
				measureSeriesKey({
					measure: "planning-applications",
					dimensions: { "application-stage": "received" },
				}),
			],
		]);
		expect(observations).toHaveLength(expected.size);
		for (const {
			measure,
			artifact: { contentHash, ...artifact },
		} of observations) {
			expect(artifact.measureId).toBe(expected.get(measure.id));
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
