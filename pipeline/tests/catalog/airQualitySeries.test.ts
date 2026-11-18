import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
	measureSeriesKey,
	type MeasureSeriesIdentity,
} from "@uk-data-atlas/measures";
import { compileAirQuality } from "../../src/catalog/airQuality.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("air quality observations use the expected series identities and hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "air-quality-series-"));
	try {
		const path = join(directory, "air-quality.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2024": {
					year: 2024,
					boundaryYear: 2024,
					boundaryType: "localAuthority",
					data: {
						E06000001: {
							gridCells: 100,
							no2Mean: 4,
							pm10Mean: 5,
							pm25Mean: 6,
							pm25PopulationWeighted: 7,
							pm25PopulationWeightedAnthropogenic: 8,
						},
					},
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [
				{ id: "air-quality", summary: { boundaryYears: [2024] } },
			],
		} as CatalogManifest;
		const expected = new Map<string, MeasureSeriesIdentity>([
			["air-quality-grid-cells", { measure: "air-quality-grid-cells" }],
			...["no2", "pm10", "pm25"].map(
				(pollutant): [string, MeasureSeriesIdentity] => [
					`${pollutant}-background-mean`,
					{
						measure: "background-concentration",
						dimensions: { pollutant },
					},
				],
			),
			[
				"pm25-population-weighted",
				{ measure: "pm25-population-weighted" },
			],
			[
				"pm25-population-weighted-anthropogenic",
				{ measure: "pm25-population-weighted-anthropogenic" },
			],
		]);
		const observations = compileAirQuality(
			manifest,
			path,
			new Set(["E06000001"]),
		);
		expect(observations).toHaveLength(expected.size);
		for (const {
			measure,
			artifact: { contentHash, ...artifact },
		} of observations) {
			const identity = expected.get(measure.id);
			expect(identity).toBeDefined();
			expect(artifact.measureId).toBe(measureSeriesKey(identity!));
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
