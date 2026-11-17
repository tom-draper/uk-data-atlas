import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import {
	APRIL_2023_LAD_MERGERS,
	APRIL_2020_2021_LAD_MERGERS,
} from "../../src/catalog/authorityChanges.ts";
import { compileUnemployment } from "../../src/catalog/unemployment.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("unemployment partitions use canonical identities and matching hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "unemployment-series-"));
	try {
		const path = join(directory, "unemployment.json");
		const published = [
			"E06000001",
			...Object.values(APRIL_2023_LAD_MERGERS).flat(),
			...Object.keys(APRIL_2020_2021_LAD_MERGERS),
			...Object.values(APRIL_2020_2021_LAD_MERGERS).flat(),
		];
		const data = Object.fromEntries(
			published.map((code) => [
				code,
				{ rates: { "2021": 5 }, levels: { "2021": 100 } },
			]),
		);
		for (const [code, predecessors] of Object.entries(
			APRIL_2023_LAD_MERGERS,
		))
			data[code] = {
				derivedFromPredecessors: predecessors,
			} as (typeof data)[string];
		writeFileSync(
			path,
			JSON.stringify({
				"2021": {
					periodLabels: { "2021": "January to December 2021" },
					data,
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [
				{ id: "unemployment", summary: { boundaryYears: [2024] } },
			],
		} as CatalogManifest;
		const result = compileUnemployment(
			manifest,
			path,
			new Set(["E06000001", ...Object.keys(APRIL_2020_2021_LAD_MERGERS)]),
		);
		expect(result.artifacts).toHaveLength(4);
		for (const { contentHash, ...artifact } of result.artifacts) {
			expect([
				measureSeriesKey({ measure: "unemployment-rate" }),
				measureSeriesKey({ measure: "unemployed-people" }),
			]).toContain(artifact.measureId);
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
