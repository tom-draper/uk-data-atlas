import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileRegionalGdp } from "../../src/catalog/regionalGdp.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { fixtureRows, type FixtureSeries } from "./rowFixtures.ts";

const manifest = {
	manifestPath: "manifest.json",
	datasets: [{ id: "regional-gdp", summary: { dataRecordCount: 3 } }],
} as CatalogManifest;

const tiers = [
	["itl1", "TLC"],
	["itl2", "TLC3"],
	["itl3", "TLC31"],
] as const;

const series = (periods: (code: string) => FixtureSeries["periods"]) =>
	tiers.flatMap(([geography, code]) =>
		[
			["gva", 100],
			["gdp", 110],
		].map(([measure, value]): FixtureSeries => ({
			dataset: "regional-gdp",
			measure: String(measure),
			geography,
			release: "2025-uk-itl",
			periods: Object.fromEntries(
				Object.entries(periods(code)).map(([period, cells]) => [
					period,
					Object.fromEntries(
						Object.keys(cells).map((area) => [area, Number(value)]),
					),
				]),
			),
		})),
	);

test("regional output partitions use canonical identities and matching hashes", () => {
	const result = compileRegionalGdp(
		manifest,
		fixtureRows(series((code) => ({ "2023": { [code]: 1 } }))),
	);
	expect(result.artifacts).toHaveLength(6);
	for (const { contentHash, ...artifact } of result.artifacts) {
		expect([
			measureSeriesKey({ measure: "gva" }),
			measureSeriesKey({ measure: "gdp" }),
		]).toContain(artifact.measureId);
		expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	}
});

test("regional output refuses a year that holds different areas", () => {
	expect(() =>
		compileRegionalGdp(
			manifest,
			fixtureRows(
				series((code) => ({
					"2022": { [code]: 1 },
					"2023": { [code]: 1, TLD: 1 },
				})),
			),
		),
	).toThrow(/holds different itl1 areas/);
});
