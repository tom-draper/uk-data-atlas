import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
	income,
	medianPaySeries,
	workplaceIncome,
} from "@uk-data-atlas/datasets";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileIncome } from "../../src/catalog/income.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("income observations use declared pay series and matching hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "income-series-"));
	try {
		const path = join(directory, "income.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2025": {
					year: 2025,
					boundaryYear: 2025,
					boundaryType: "localAuthority",
					data: {
						E06000001: {
							annual: { median: 29000 },
							hourly: { median: 15 },
						},
					},
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [
				{ id: "income", summary: { boundaryYears: [2025] } },
				{ id: "workplace-income", summary: { boundaryYears: [2025] } },
			],
		} as CatalogManifest;
		const expected = new Set(medianPaySeries().map(measureSeriesKey));
		for (const [datasetId, declaration] of [
			["income", income],
			["workplace-income", workplaceIncome],
		] as const) {
			const fields = declaration.statistics!.fields!;
			if (!Array.isArray(fields))
				throw new Error("Expected income fields");
			const observations = compileIncome(manifest, path, ["E06000001"], {
				datasetId,
			});
			expect(observations).toHaveLength(2);
			for (const {
				artifact: { contentHash, ...artifact },
				statisticsField,
			} of observations) {
				const field = fields.find(
					(candidate) => candidate.path === statisticsField?.field,
				)!;
				expect(artifact.measureId).toBe(
					measureSeriesKey({
						measure: field.measure,
						dimensions: field.members,
					}),
				);
				expect(expected.delete(artifact.measureId)).toBe(true);
				expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
			}
		}
		expect(expected.size).toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
