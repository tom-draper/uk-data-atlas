import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
	rebuildStatisticsObservationText,
	type StatisticsSelector,
} from "@uk-data-atlas/atlas-runtime/storage";

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
		CREATE TABLE area_releases (position INTEGER, geography TEXT, id TEXT);
		CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER);
		CREATE TABLE dimension (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
		CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT);
		CREATE TABLE status (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, lower REAL, upper REAL, status_id INTEGER);
		INSERT INTO dataset VALUES (1, 'local-election');
		INSERT INTO measure VALUES (1, 'party-votes'), (2, 'valid-votes');
		INSERT INTO area_releases VALUES (0, 'ward', '2019-12-uk-bgc');
		INSERT INTO dimension VALUES (1, 'party');
		INSERT INTO dimension_member VALUES (1, 'lab'), (2, 'green');
		INSERT INTO series VALUES (1, 1, 1, 0), (2, 1, 1, 0), (3, 1, 2, 0);
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

	it("serves a corrected code and keeps the stored one as its source", () => {
		expect(
			rebuild({ ...labour, servedCodes: { E05099999: "E05000003" } }),
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

	it("sums a dimension with no total", () => {
		expect(rebuild({ ...labour, dimensions: {}, sum: ["party"] })).toEqual([
			{ areaCode: "E05000001", value: 300, status: "observed" },
			{ areaCode: "E05000002", value: 40, status: "observed" },
			{ areaCode: "E05099999", value: 25, status: "observed" },
		]);
	});
});
