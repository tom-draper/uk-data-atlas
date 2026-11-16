import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { homelessness, homelessnessSeries } from "@uk-data-atlas/datasets";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileHomelessness } from "../../src/catalog/homelessness.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("homelessness observations use declared fields and matching hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "homelessness-series-"));
	try {
		const path = join(directory, "homelessness.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2026": {
					year: 2026,
					boundaryYear: 2025,
					boundaryType: "localAuthority",
					data: {
						E06000001: {
							householdsInTemporaryAccommodation: 62,
							householdsWithChildren: 30,
							childrenInTemporaryAccommodation: 54,
						},
					},
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [
				{ id: "homelessness", summary: { boundaryYears: [2025] } },
			],
		} as CatalogManifest;
		const observations = compileHomelessness(manifest, path, ["E06000001"]);
		const fields = homelessness.statistics!.fields!;
		if (!Array.isArray(fields))
			throw new Error("Expected homelessness fields");
		const expected = new Set(homelessnessSeries().map(measureSeriesKey));
		expect(observations).toHaveLength(3);
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
		expect(expected.size).toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
