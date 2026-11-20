import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import {
	APRIL_2023_LAD_MERGERS,
	APRIL_2020_2021_LAD_MERGERS,
} from "../../src/catalog/authorityChanges.ts";
import { compileUnemployment } from "../../src/catalog/unemployment.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { fixtureRows } from "./rowFixtures.ts";

const manifest = {
	manifestPath: "manifest.json",
	datasets: [{ id: "unemployment", summary: { boundaryYears: [2024] } }],
} as CatalogManifest;

const replaced = Object.values(APRIL_2020_2021_LAD_MERGERS).flat();
const replacements = Object.keys(APRIL_2020_2021_LAD_MERGERS);
const authorities = new Set(["E06000001", ...replacements]);

/** The 2019 districts, the 2021 authorities, and the areas both hold. */
const areaReleases = {
	...Object.fromEntries(
		["E06000001", ...Object.values(APRIL_2023_LAD_MERGERS).flat()].map(
			(code) => [code, ["2019-uk-bfc", "2021-uk-bfc"]],
		),
	),
	...Object.fromEntries(replaced.map((code) => [code, ["2019-uk-bfc"]])),
	...Object.fromEntries(replacements.map((code) => [code, ["2021-uk-bfc"]])),
};
const everyCode = Object.keys(areaReleases);

/** A measure and the half-width of its interval, which is a series of its own. */
const series = (measure: string, value: number) =>
	[measure, `${measure}-interval`].map((slug) => ({
		...partition(slug, slug === measure ? value : value / 10),
	}));

const partition = (measure: string, value: number) => ({
	dataset: "unemployment",
	measure,
	geography: "localAuthority",
	release: "2019-uk-bfc",
	areaReleases,
	periods: {
		"2021": Object.fromEntries(everyCode.map((code) => [code, value])),
	},
});

test("unemployment partitions use canonical identities and matching hashes", () => {
	const rows = fixtureRows([
		...series("unemployment-rate", 5),
		...series("unemployed-people", 100),
	]);
	const result = compileUnemployment(manifest, rows, authorities);
	expect(result.artifacts).toHaveLength(4);
	for (const { contentHash, ...artifact } of result.artifacts) {
		expect([
			measureSeriesKey({ measure: "unemployment-rate" }),
			measureSeriesKey({ measure: "unemployed-people" }),
		]).toContain(artifact.measureId);
		expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	}
});

test("unemployment serves each code vintage only its own authorities", () => {
	const rows = fixtureRows([
		...series("unemployment-rate", 5),
		...series("unemployed-people", 100),
	]);
	const result = compileUnemployment(manifest, rows, authorities);
	const codes = (boundaryYear: number) =>
		result.artifacts
			.find(
				(artifact) =>
					artifact.sourceGeography.boundaryYear === boundaryYear,
			)
			?.periods[0]?.records.map((record) => record.areaCode)
			.sort();
	const shared = [
		"E06000001",
		...Object.values(APRIL_2023_LAD_MERGERS).flat(),
	];
	expect(codes(2021)).toEqual([...shared, ...replacements].sort());
	expect(codes(2019)).toEqual([...shared, ...replaced].sort());
});
