import { expect, test } from "vitest";
import { compileElections } from "../../src/catalog/elections.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { fixtureRows, type FixtureSeries } from "./rowFixtures.ts";

const votes = (
	dataset: string,
	geography: string,
	day: string,
	party: string,
	cells: Record<string, number>,
): FixtureSeries => ({
	dataset,
	measure: "party-votes",
	geography,
	release: "2019-uk-bfc",
	members: { party },
	periods: { [day]: cells },
});

const manifest = {
	manifestPath: "manifest",
	datasets: [
		{
			id: "general-election",
			summary: {
				dataRecordCount: 1,
				datasetCount: 1,
				boundaryYears: [2019],
			},
		},
		{
			id: "local-election",
			summary: {
				dataRecordCount: 3,
				datasetCount: 1,
				boundaryYears: [2019],
			},
		},
	],
} as CatalogManifest;

const compile = (extra: FixtureSeries[] = []) => {
	const rows = fixtureRows(
		[
			{
				dataset: "general-election",
				measure: "valid-votes",
				geography: "constituency",
				release: "2019-uk-bfc",
				periods: { "2019-12-12": { E14000001: 100 } },
			},
			...["electorate", "rejected-ballots"].map(
				(measure): FixtureSeries => ({
					dataset: "general-election",
					measure,
					geography: "constituency",
					release: "2019-uk-bfc",
					periods: { "2019-12-12": { E14000001: 150 } },
				}),
			),
			votes("general-election", "constituency", "2019-12-12", "con", {
				E14000001: 100,
			}),
			// A ward the publisher listed under another code, and a county
			// electoral division held beside the wards.
			votes("local-election", "ward", "2019-05-02", "con", {
				E05000001: 60,
				E05013831: 25,
			}),
			{
				dataset: "local-election",
				measure: "turnout",
				geography: "ward",
				release: "2019-uk-bfc",
				periods: { "2024-05-02": { E05000001: 40 } },
			},
			votes(
				"local-election",
				"countyElectoralDivision",
				"2019-05-02",
				"con",
				{
					E58000050: 30,
				},
			),
			...extra,
		],
		[],
		[],
	);
	try {
		return compileElections(manifest, rows);
	} finally {
		rows.close();
	}
};

test("local elections serve a ward under the code in force and say so in the note", () => {
	const result = compile();
	const artifact = result.artifacts.find(
		(entry) =>
			entry.measureId.includes("local-election") &&
			entry.measureId.includes("con"),
	)!;
	expect(
		artifact.periods[0]!.records.map((record) => record.areaCode),
	).toEqual(["E05000001", "E05011412"]);
	const measure = result.measures.find(
		(entry) => entry.id === "local-election-con-votes",
	)!;
	const note = measure.sources[0]!.coverage.note;
	expect(note).toContain("E05013831 as E05011412");
	expect(note).toContain("County-electoral-division rows are excluded");
});

test("a declared polling year the rows hold nothing of is not published", () => {
	const result = compile();
	const measure = result.measures.find(
		(entry) => entry.id === "local-election-effective-votes",
	)!;
	expect(measure.sources.map((source) => source.periods)).toEqual([["2019"]]);
});
