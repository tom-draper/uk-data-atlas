import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileJobs } from "../../src/catalog/jobs.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { fixtureRows } from "./rowFixtures.ts";

const manifest = {
	manifestPath: "manifest.json",
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

test("jobs observations use their canonical identity and matching hash", () => {
	const rows = fixtureRows([
		{
			dataset: "jobs",
			measure: "total-jobs",
			geography: "localAuthority",
			release: "2023-uk-bfc",
			periods: { "2022": { E06000001: 1000 } },
		},
	]);
	const {
		artifact: { contentHash, ...artifact },
	} = compileJobs(manifest, rows, new Set(["E06000001"]));
	expect(artifact.measureId).toBe(
		measureSeriesKey({ measure: "total-jobs" }),
	);
	expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
});

test("jobs refuses a gap that is not a whole nation", () => {
	const rows = fixtureRows([
		{
			dataset: "jobs",
			measure: "total-jobs",
			geography: "localAuthority",
			release: "2023-uk-bfc",
			periods: { "2022": { E06000001: 1000 } },
		},
	]);
	expect(() =>
		compileJobs(manifest, rows, new Set(["E06000001", "E06000002"])),
	).toThrow(/not a whole nation/);
});
