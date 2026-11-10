import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
	rebuildStatisticsObservationText,
	type StatisticsSelector,
} from "@uk-data-atlas/measures";

/**
 * A local election in three wards, as the statistics tables hold it: party
 * votes only where a party stood, valid votes for every ward, and one ward
 * stored under its publisher's code.
 */
const election = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE area_releases (id INTEGER, geography TEXT, release TEXT);
		CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT NOT NULL DEFAULT 'published');
		CREATE TABLE dimension (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
		CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT);
		CREATE TABLE status (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE v_contest (dataset TEXT, geography TEXT, polling_day TEXT, area_code TEXT, winner TEXT);
		INSERT INTO v_contest VALUES ('local-election', 'ward', '2019-05-02', 'E05000001', 'LAB'), ('local-election', 'ward', '2019-05-02', 'E05000002', 'GREEN'), ('local-election', 'ward', '2019-05-02', 'E05099999', NULL);
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, lower REAL, upper REAL, status_id INTEGER);
		INSERT INTO dataset VALUES (1, 'local-election');
		INSERT INTO measure VALUES (1, 'party-votes'), (2, 'valid-votes');
		INSERT INTO area_releases VALUES (0, 'ward', '2019-12-uk-bgc');
		INSERT INTO dimension VALUES (1, 'party');
		INSERT INTO dimension_member VALUES (1, 'lab'), (2, 'green');
		INSERT INTO series (id, dataset_id, measure_id, release_id) VALUES (1, 1, 1, 0), (2, 1, 1, 0), (3, 1, 2, 0);
		INSERT INTO series_member VALUES (1, 1, 1), (2, 1, 2);
		INSERT INTO area VALUES (1, 'E05000001'), (2, 'E05000002'), (3, 'E05099999');
		INSERT INTO area_version VALUES (1, 1, 0), (2, 2, 0), (3, 3, 0);
		INSERT INTO period VALUES (1, '2019-05-02');
		INSERT INTO status VALUES (1, 'observed');
		INSERT INTO observation VALUES
			(1, 1, 1, 300, NULL, NULL, 1),
			(2, 2, 1, 40, NULL, NULL, 1),
			(1, 3, 1, 25, NULL, NULL, 1),
			(3, 1, 1, 600, NULL, NULL, 1),
			(3, 2, 1, 400, NULL, NULL, 1),
			(3, 3, 1, 50, NULL, NULL, 1);
	`);
	return database;
};

const labour: StatisticsSelector = {
	datasetId: "local-election",
	measure: "party-votes",
	dimensions: { party: "lab" },
	geography: "ward",
};

const rebuild = (selector: StatisticsSelector) =>
	(
		JSON.parse(
			rebuildStatisticsObservationText(election(), selector, {
				measureId: "local-election-lab-votes",
				sourceGeography: { type: "ward", boundaryYear: 2019 },
				periods: ["2019"],
			}),
		) as { periods: Array<{ records: unknown[] }> }
	).periods[0]!.records;

describe("observation artifacts rebuilt from statistics rows", () => {
	it("reads a party with no row in a contest as no votes", () => {
		expect(rebuild(labour)).toEqual([
			{ areaCode: "E05000001", value: 300, status: "observed" },
			{ areaCode: "E05099999", value: 25, status: "observed" },
		]);
		expect(rebuild({ ...labour, absentAsZero: true })).toEqual([
			{ areaCode: "E05000001", value: 300, status: "observed" },
			{ areaCode: "E05000002", value: 0, status: "observed" },
			{ areaCode: "E05099999", value: 25, status: "observed" },
		]);
	});

	it("serves a corrected code and keeps the published one as its source", () => {
		expect(
			rebuild({
				...labour,
				servedCodes: {
					E05099999: {
						areaCode: "E05000003",
						sourceAreaCode: "E05099999",
					},
				},
			}),
		).toEqual([
			{ areaCode: "E05000001", value: 300, status: "observed" },
			{
				areaCode: "E05000003",
				sourceAreaCode: "E05099999",
				value: 25,
				status: "observed",
			},
		]);
	});

	it("divides by another measure for a share", () => {
		expect(
			rebuild({
				...labour,
				absentAsZero: true,
				ratio: { measure: "valid-votes", scale: 100 },
			}),
		).toEqual([
			{ areaCode: "E05000001", value: 50, status: "observed" },
			{ areaCode: "E05000002", value: 0, status: "observed" },
			{ areaCode: "E05099999", value: 50, status: "observed" },
		]);
	});

	it("serves a compiled code under the code it was published for", () => {
		expect(
			rebuild({
				...labour,
				servedCodes: { E05099999: { areaCode: "E05000000" } },
			}),
		).toEqual([
			{ areaCode: "E05000000", value: 25, status: "observed" },
			{ areaCode: "E05000001", value: 300, status: "observed" },
		]);
	});

	it("adds measures and scales the quotient, as turnout is computed", () => {
		expect(
			rebuild({
				...labour,
				plus: ["valid-votes"],
				ratio: {
					measure: "valid-votes",
					scale: 100,
					scaleQuotient: true,
				},
			}),
		).toEqual([
			{ areaCode: "E05000001", value: 150, status: "observed" },
			{ areaCode: "E05099999", value: 150, status: "observed" },
		]);
	});

	it("bounds a value by a half-width measure, rounded", () => {
		expect(
			rebuild({
				...labour,
				halfWidth: { measure: "valid-votes", digits: 1 },
			}),
		).toEqual([
			{
				areaCode: "E05000001",
				value: 300,
				status: "observed",
				confidenceInterval: { lower: -300, upper: 900 },
			},
			{
				areaCode: "E05099999",
				value: 25,
				status: "observed",
				confidenceInterval: { lower: -25, upper: 75 },
			},
		]);
	});

	it("divides by another dataset's measure in one period, as derived", () => {
		expect(
			rebuild({
				...labour,
				ratio: {
					datasetId: "local-election",
					measure: "valid-votes",
					period: "2019-05-02",
					denominatorDivisor: 2,
					scale: 1,
					scaleQuotient: true,
				},
				status: "derived",
			}),
		).toEqual([
			{ areaCode: "E05000001", value: 1, status: "derived" },
			{ areaCode: "E05099999", value: 1, status: "derived" },
		]);
	});

	it("reads each contest's winner as a category", () => {
		expect(rebuild({ ...labour, contest: "winner" })).toEqual([
			{ areaCode: "E05000001", category: "LAB", status: "observed" },
			{ areaCode: "E05000002", category: "GREEN", status: "observed" },
		]);
	});

	it("rebuilds a table, one column per series, in area code order", () => {
		const table = JSON.parse(
			rebuildStatisticsObservationText(
				election(),
				{
					kind: "measure-table",
					id: "votes-ward-2019-table",
					datasetId: "local-election",
					geography: "ward",
					boundaryYear: 2019,
					period: "2019",
					measures: ["lab-votes", "green-votes"],
					columns: [
						{
							measure: "party-votes",
							dimensions: { party: "lab" },
						},
						{
							measure: "party-votes",
							dimensions: { party: "green" },
						},
					],
				},
				{
					measureId: "lab-votes",
					sourceGeography: { type: "ward", boundaryYear: 2019 },
					periods: ["2019"],
				},
			),
		) as { kind: string; records: unknown[]; contentHash: string };
		expect(table.kind).toBe("measure-table");
		expect(table.records).toEqual([
			["E05000001", 300, null],
			["E05000002", null, 40],
			["E05099999", 25, null],
		]);
		expect(table.contentHash).toMatch(/^sha256:/);
	});

	it("sums a dimension with no total", () => {
		expect(rebuild({ ...labour, dimensions: {}, sum: ["party"] })).toEqual([
			{ areaCode: "E05000001", value: 300, status: "observed" },
			{ areaCode: "E05000002", value: 40, status: "observed" },
			{ areaCode: "E05099999", value: 25, status: "observed" },
		]);
	});
});
