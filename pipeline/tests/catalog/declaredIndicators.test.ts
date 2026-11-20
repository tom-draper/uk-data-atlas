import { expect, test } from "vitest";
import type { DatasetDeclaration } from "@uk-data-atlas/datasets";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import {
	compileDeclaredIndicators,
	compileYearlyIndicators,
} from "../../src/catalog/declaredIndicators.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { fixtureRows } from "./rowFixtures.ts";

const manifest = {
	manifestPath: "manifest.json",
	datasets: [
		{
			id: "example",
			summary: {
				dataRecordCount: 2,
				datasetCount: 1,
				boundaryYears: [2025],
			},
		},
	],
} as CatalogManifest;

const declaration = {
	id: "example",
	boundary: { year: 2025, type: "localAuthority" },
	source: { notes: [] },
	catalogue: {
		period: "2023",
		coverageNote: "",
		checks: ["manifest-records"],
		indicators: [
			{
				id: "old-example",
				measure: "population",
				members: { age: "child" },
				label: "Children",
				field: "value",
				valueKind: "count",
				unit: "people",
				aggregation: "sum",
				notes: [],
			},
		],
	},
} as unknown as DatasetDeclaration;

const rowsOf = (periods: Record<string, Record<string, number>>) =>
	fixtureRows([
		{
			dataset: "example",
			measure: "population",
			geography: "localAuthority",
			release: "2025-uk-bfc",
			members: { age: "child" },
			periods,
		},
	]);

const codeSets = { authorities: [], england2025: [] };

test("declared indicators generate canonical identities for single and yearly observations", () => {
	const rows = rowsOf({
		"2023": { E08000001: 12, E08000002: 7 },
	});
	const single = compileDeclaredIndicators(
		manifest,
		declaration,
		rows,
		codeSets,
	)[0]!.artifact;
	const yearly = compileYearlyIndicators(manifest, declaration, rows)
		.artifacts[0]!;
	const expected = measureSeriesKey({
		measure: "population",
		dimensions: { age: "child" },
	});
	for (const { contentHash, ...artifact } of [single, yearly]) {
		expect(artifact.measureId).toBe(expected);
		expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	}
	expect(single.periods[0]?.records.map((record) => record.value)).toEqual([
		12, 7,
	]);
});

test("yearly indicators publish every period the rows hold", () => {
	const rows = rowsOf({
		"2022": { E08000001: 10, E08000002: 5 },
		"2023": { E08000001: 12, E08000002: 7 },
	});
	const { measures, artifacts } = compileYearlyIndicators(
		{
			...manifest,
			datasets: [
				{
					...manifest.datasets[0]!,
					summary: {
						dataRecordCount: 4,
						datasetCount: 2,
						boundaryYears: [2025],
					},
				},
			],
		} as CatalogManifest,
		declaration,
		rows,
	);
	expect(artifacts[0]?.periods.map(({ period }) => period)).toEqual([
		"2022",
		"2023",
	]);
	expect(measures[0]?.sources[0]?.periods).toEqual(["2022", "2023"]);
});

test("yearly indicators refuse rows that do not match the manifest's record count", () => {
	const rows = rowsOf({ "2023": { E08000001: 12 } });
	expect(() => compileYearlyIndicators(manifest, declaration, rows)).toThrow(
		/expected 2 records from the manifest, found 1/,
	);
});

test("yearly indicators refuse a measure the rows do not hold", () => {
	const rows = fixtureRows([]);
	expect(() => compileYearlyIndicators(manifest, declaration, rows)).toThrow(
		/population is not in the statistics tables/,
	);
});
