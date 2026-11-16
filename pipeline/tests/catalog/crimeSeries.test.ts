import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { crime, crimeSeries } from "@uk-data-atlas/datasets";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileCrime } from "../../src/catalog/crime.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("crime observations use the declared offence members and matching hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "crime-series-"));
	try {
		const path = join(directory, "crime.json");
		const members = crime.statistics!.dimensions!.find(
			(dimension) => dimension.slug === "offence",
		)!.members!;
		writeFileSync(
			path,
			JSON.stringify({
				"2026": {
					year: 2026,
					dataDate: "year ending March 2026",
					boundaryYear: 2026,
					boundaryType: "localAuthority",
					partnerships: {
						E22000100: Object.fromEntries(
							members.map(({ key }, index) => [key, index + 1]),
						),
					},
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [{ id: "crime", summary: { boundaryYears: [2026] } }],
		} as CatalogManifest;
		const observations = compileCrime(manifest, path);
		const expected = new Set(crimeSeries().map(measureSeriesKey));
		expect(observations).toHaveLength(members.length);
		for (const {
			artifact: { contentHash, ...artifact },
			statisticsField,
		} of observations) {
			expect(expected.delete(artifact.measureId)).toBe(true);
			const member = members.find(
				({ key }) => key === statisticsField?.field,
			)!;
			expect(artifact.measureId).toBe(
				measureSeriesKey({
					measure: "recorded-crimes",
					dimensions: { offence: member.code ?? member.key },
				}),
			);
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
		}
		expect(expected.size).toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
