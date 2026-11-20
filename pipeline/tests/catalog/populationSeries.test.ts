import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compilePopulation } from "../../src/catalog/population.ts";
import { compilePopulationDensity } from "../../src/catalog/populationDensity.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { fixtureRows } from "./rowFixtures.ts";

test("population partitions and density use canonical series and matching hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "population-series-"));
	try {
		const write = (name: string, content: unknown) => {
			const path = join(directory, `${name}.json`);
			writeFileSync(path, JSON.stringify(content));
			return path;
		};
		const ward = write("ward", {
			"2022": {
				boundaryYear: 2023,
				boundaryType: "ward",
				data: { E05000001: { total: [2, 3] } },
			},
		});
		const authority = write("authority", {
			"2022": {
				year: 2022,
				boundaryYear: 2023,
				boundaryType: "localAuthority",
				data: { E06000001: { total: [2, 3] } },
			},
		});
		const constituency = write("constituency", {
			"2022": {
				year: 2022,
				boundaryYear: 2024,
				boundaryType: "constituency",
				data: { E14001063: { allAges: 5 } },
			},
		});
		const rows = fixtureRows([
			{
				dataset: "population-uk",
				measure: "population",
				geography: "localAuthority",
				release: "2023-uk-bfc",
				periods: { "2022": { E06000001: 5 } },
			},
			{
				dataset: "land-area",
				measure: "area",
				geography: "localAuthority",
				release: "2024-uk-bfc",
				members: { surface: "land" },
				// Hectares, which the density divides down to square kilometres.
				periods: { "2024": { E06000001: 200 } },
			},
		]);
		const manifest = {
			manifestPath: directory,
			datasets: [
				{
					id: "population",
					summary: { dataRecordCount: 1, boundaryYears: [2023] },
				},
				{
					id: "population-uk",
					summary: {
						dataRecordCount: 1,
						datasetCount: 1,
						boundaryYears: [2023],
					},
				},
				{
					id: "population-constituency",
					summary: { dataRecordCount: 1, boundaryYears: [2024] },
				},
				{ id: "land-area", summary: { boundaryYears: [2024] } },
			],
		} as CatalogManifest;
		const result = compilePopulation(
			manifest,
			ward,
			authority,
			constituency,
		);
		const density = compilePopulationDensity(
			manifest,
			rows,
			result.localAuthorityObservations.periods,
		);
		for (const artifact of [
			result.wardObservations,
			result.localAuthorityObservations,
			result.constituencyObservations,
			density.artifact,
		]) {
			const { contentHash, ...content } = artifact;
			expect(artifact.measureId).toBe(
				measureSeriesKey({
					measure:
						artifact === density.artifact
							? "population-density"
							: "population",
				}),
			);
			expect(contentHash).toBe(sha256(JSON.stringify(content)));
		}
		expect(density.artifact.periods[0]!.records[0]!.value).toBe(2.5);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
