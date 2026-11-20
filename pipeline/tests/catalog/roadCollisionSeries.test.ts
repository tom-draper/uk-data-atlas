import { expect, test } from "vitest";
import { roadCollisionSeries } from "@uk-data-atlas/datasets";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileRoadCollisions } from "../../src/catalog/roadCollisions.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import {
	fixtureRows,
	type FixtureGap,
	type FixtureSeries,
} from "./rowFixtures.ts";

const manifest = {
	manifestPath: "manifest.json",
	datasets: [
		{
			id: "road-collisions",
			summary: { boundaryYears: [2024, 2025] },
		},
	],
} as CatalogManifest;

const count = (severity: string | undefined) =>
	({ all: 6, fatal: 1, serious: 2, slight: 3 })[severity ?? "all"]!;

const collisionSeries = (): FixtureSeries[] =>
	roadCollisionSeries().flatMap(
		({ measure, dimensions }): FixtureSeries[] => {
			const severity = dimensions?.["collision-severity"];
			const base = {
				dataset: "road-collisions",
				measure,
				members: dimensions,
			};
			return [
				{
					...base,
					geography: "localAuthority",
					release: "2024-05-uk-bgc",
					periods: { "2024": { E08000001: count(severity) } },
				},
				{
					...base,
					geography: "localAuthority",
					release: "2025-05-uk-bgc-v2",
					periods: { "2025": { E08000001: count(severity) } },
				},
				{
					...base,
					geography: "lsoa",
					release: "2021-12-ew-bgc-v5",
					periods: {
						"2024": { E01000001: count(severity) },
						"2025": { E01000001: count(severity) },
					},
				},
			];
		},
	);

const gaps: FixtureGap[] = [
	{
		dataset: "road-collisions",
		edition: "2024",
		kind: "collision-area",
		code: "EHEATHROW",
		count: 33,
	},
	{
		dataset: "road-collisions",
		edition: "2025",
		kind: "collision-area",
		code: "EHEATHROW",
		count: 1,
	},
];

test("road collision observations use declared severity series across periods", () => {
	const results = compileRoadCollisions(
		manifest,
		fixtureRows(collisionSeries(), gaps),
		new Set(["E08000001"]),
	);
	const expected = new Set(roadCollisionSeries().map(measureSeriesKey));
	// Each edition is its own local-authority vintage, and the LSOA partition
	// is one series over both.
	expect(results).toHaveLength(12);
	for (const {
		artifact: { contentHash, ...artifact },
	} of results) {
		expect(expected.has(artifact.measureId)).toBe(true);
		expect(artifact.periods.map(({ period }) => period)).toEqual(
			artifact.sourceGeography.type === "lsoa"
				? ["2024", "2025"]
				: [String(artifact.sourceGeography.boundaryYear)],
		);
		expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	}
});

test("road collisions name what each edition's coverage left out", () => {
	const results = compileRoadCollisions(
		manifest,
		fixtureRows(collisionSeries(), gaps),
		new Set(["E08000001", "E08000002"]),
	);
	const note = (boundaryYear: number) =>
		results.find(
			({ artifact }) =>
				artifact.sourceGeography.type === "localAuthority" &&
				artifact.sourceGeography.boundaryYear === boundaryYear,
		)!.measure.sources[0]!.coverage.note;
	expect(note(2024)).toMatch(
		/33 collisions assigned to EHEATHROW, which is not a local authority code, are not counted/,
	);
	expect(note(2024)).toMatch(
		/No value is published for 1 of the 2 authorities: E08000002\./,
	);
	expect(note(2025)).toMatch(
		/1 collision assigned to EHEATHROW.* is not counted/,
	);
	const lsoa = results.find(
		({ artifact }) => artifact.sourceGeography.type === "lsoa",
	)!.measure.sources[0]!;
	expect(lsoa.sourceGeography).toEqual({ type: "lsoa", boundaryYear: 2021 });
	expect(lsoa.periods).toEqual(["2024", "2025"]);
});
