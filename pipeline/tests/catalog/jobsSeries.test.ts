import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileJobs } from "../../src/catalog/jobs.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("jobs observations use their canonical identity and matching hash", () => {
	const directory = mkdtempSync(join(tmpdir(), "jobs-series-"));
	try {
		const path = join(directory, "jobs.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2022": {
					year: 2022,
					boundaryYear: 2023,
					boundaryType: "localAuthority",
					data: { E06000001: { totalJobs: 1000 } },
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [
				{
					id: "jobs",
					summary: {
						dataRecordCount: 1,
						datasetCount: 1,
						boundaryYears: [2023],
					},
				},
			],
		} as CatalogManifest;
		const {
			artifact: { contentHash, ...artifact },
		} = compileJobs(manifest, path, new Set(["E06000001"]));
		expect(artifact.measureId).toBe(
			measureSeriesKey({ measure: "total-jobs" }),
		);
		expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
