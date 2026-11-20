import { expect, test } from "vitest";
import { crimeSeries } from "@uk-data-atlas/datasets";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileCrime } from "../../src/catalog/crime.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { fixtureRows, type FixtureSeries } from "./rowFixtures.ts";

const manifest = {
	manifestPath: "manifest.json",
	datasets: [{ id: "crime", summary: { boundaryYears: [2026] } }],
} as CatalogManifest;

const offenceSeries = (period: string): FixtureSeries[] =>
	crimeSeries().map(({ measure, dimensions }, index) => ({
		dataset: "crime",
		measure,
		members: dimensions,
		geography: "communitySafetyPartnership",
		release: "2023-12-ew-bgc",
		periods: { [period]: { E22000100: index + 1, E22000362: -index } },
	}));

test("crime observations use the declared offence members and matching hashes", () => {
	const observations = compileCrime(
		manifest,
		fixtureRows(offenceSeries("year-ending-2026-03")),
	);
	const expected = new Set(crimeSeries().map(measureSeriesKey));
	expect(observations).toHaveLength(crimeSeries().length);
	for (const {
		artifact: { contentHash, ...artifact },
		measure,
	} of observations) {
		expect(expected.delete(artifact.measureId)).toBe(true);
		expect(artifact.periods.map(({ period }) => period)).toEqual([
			"year-ending-2026-03",
		]);
		expect(artifact.sourceGeography).toEqual({
			type: "communitySafetyPartnership",
			boundaryYear: 2023,
		});
		expect(measure.sources[0]?.coverage.recordCount).toBe(2);
		expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	}
	expect(expected.size).toBe(0);
});

test("crime names its months from the period and the partnerships its declaration withholds", () => {
	const [{ measure }] = compileCrime(
		manifest,
		fixtureRows(offenceSeries("year-ending-2026-03")),
	);
	expect(measure.notes?.join(" ")).toMatch(
		/twelve months to March 2026, by the community safety partnership/,
	);
	expect(measure.notes?.join(" ")).toMatch(
		/No figures for Dartford and Gravesham/,
	);
	expect(measure.sources[0]?.coverage.note).toMatch(
		/except those whose crime the police recorded as unassigned/,
	);
});

test("crime refuses rows that do not hold one twelve-month period", () => {
	expect(() =>
		compileCrime(manifest, fixtureRows(offenceSeries("2026"))),
	).toThrow(/one period naming the twelve months/);
	expect(() =>
		compileCrime(
			manifest,
			fixtureRows([
				...offenceSeries("year-ending-2026-03"),
				...offenceSeries("year-ending-2025-03"),
			]),
		),
	).toThrow(/one period naming the twelve months/);
});
