import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "vitest";
import {
	formatCountries,
	nationOf,
	writeSeriesCoverage,
} from "../../src/storage/seriesCoverage.ts";

describe("nationOf", () => {
	test("an ONS code prefix names the nation", () => {
		assert.equal(nationOf("E08000003", []), "E");
		assert.equal(nationOf("W06000001", ["E"]), "W");
		assert.equal(nationOf("S12000033", []), "S");
		assert.equal(nationOf("N09000001", []), "N");
	});

	test("a code with no prefix takes the one nation its release covers", () => {
		assert.equal(nationOf("95AA01", ["N"]), "N");
		assert.equal(nationOf("95AA01", ["E", "N"]), "?");
	});

	test("an ITL code is read from its third letter", () => {
		assert.equal(nationOf("TLC1", ["E", "N", "S", "W"]), "E");
		assert.equal(nationOf("TLK2", ["E", "N", "S", "W"]), "E");
		assert.equal(nationOf("TLL1", ["E", "N", "S", "W"]), "W");
		assert.equal(nationOf("TLM", ["E", "N", "S", "W"]), "S");
		assert.equal(nationOf("TLN0", ["E", "N", "S", "W"]), "N");
	});

	test("anything else is unknown", () => {
		assert.equal(nationOf("1234", ["E", "N", "S", "W"]), "?");
		assert.equal(nationOf("", []), "?");
	});
});

test("formatCountries sorts the nations and puts the unknown last", () => {
	assert.equal(formatCountries(["W", "E"]), "E,W");
	assert.equal(formatCountries(["?", "S", "N"]), "N,S,?");
	assert.equal(formatCountries([]), "");
});

const fixture = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE measure_conversion (measure_id INTEGER PRIMARY KEY, rule TEXT, reason TEXT);
		CREATE TABLE dimension (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, dimension_id INTEGER, code TEXT);
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		CREATE TABLE boundary_release_country (release_id INTEGER, country TEXT);
		CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT, kind TEXT, start_date TEXT, end_date TEXT);
		CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER, in_inventory INTEGER);
		CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT, derived_from_id INTEGER, key TEXT);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE quantity (id INTEGER PRIMARY KEY, key TEXT);
		CREATE TABLE series_preference (series_id INTEGER PRIMARY KEY, quantity_id INTEGER, rank INTEGER);
		CREATE TABLE series_conversion (series_id INTEGER PRIMARY KEY, exact_share REAL, coverage REAL);
		CREATE TABLE conversion_skip (dataset_id INTEGER, measure_id INTEGER, source_release_id INTEGER, target_release_id INTEGER, reason TEXT, series INTEGER);
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, status_id INTEGER, category_id INTEGER, PRIMARY KEY (series_id, area_version_id, period_id));
		INSERT INTO measure VALUES (1, 'population'), (2, 'claimant-rate'), (3, 'tenure');
		INSERT INTO measure_conversion VALUES (2, 'refuse', 'The 16 to 64 population is not held.');
		INSERT INTO dimension VALUES (1, 'age');
		INSERT INTO dimension_member VALUES (1, 1, 'total'), (2, 1, '16-24');
		INSERT INTO dataset VALUES (1, 'census'), (2, 'claimants');
		-- release 1: local authorities on England, Wales and Scotland. Release 2: wards, converted onto.
		INSERT INTO area_release VALUES (1, 'localAuthority', '2024'), (2, 'ward', '2024'), (3, 'superOutputArea', '2011-ni');
		INSERT INTO boundary_release_country VALUES (1, 'GB-ENG'), (1, 'GB-WLS'), (1, 'GB-SCT'), (3, 'GB-NIR');
		INSERT INTO period VALUES (1, '2021', 'year', '2021-01-01', '2021-12-31'), (2, '2022', 'year', '2022-01-01', '2022-12-31');
		INSERT INTO area VALUES (1, 'E06000001'), (2, 'W06000001'), (3, 'S12000033'), (4, 'E06000002'), (5, '95AA01');
		-- Release 1 holds four areas in its inventory and one outside it.
		INSERT INTO area_version VALUES (1, 1, 1, 1), (2, 2, 1, 1), (3, 3, 1, 1), (4, 4, 1, 1), (5, 4, 1, 0), (6, 5, 3, 1);
		INSERT INTO series VALUES
		  (1, 1, 1, 1, 'published', NULL, 'census/population'),
		  (2, 1, 1, 1, 'converted', 1, 'census/population/converted'),
		  (3, 1, 1, 1, 'published', NULL, 'census/population/age=16-24'),
		  (4, 1, 3, 3, 'published', NULL, 'census/tenure');
		INSERT INTO series_member VALUES (3, 1, 2);
		INSERT INTO quantity VALUES (1, 'population/localAuthority:2024'), (2, 'tenure/superOutputArea:2011-ni');
		INSERT INTO series_preference VALUES (1, 1, 1), (2, 1, 2), (4, 2, 1);
		INSERT INTO series_conversion VALUES (2, 0.75, 0.9);
		-- Series 1: 2021 has three areas, one with a NULL value; 2022 has one area.
		-- Series 2: 2021 on England and Wales only. Series 3: a part of a total.
		-- Series 4: a status-only row and a category-only row, on Northern Ireland.
		INSERT INTO observation VALUES
		  (1, 1, 1, 10, 1, NULL), (1, 2, 1, NULL, 2, NULL), (1, 3, 1, 5, 1, NULL), (1, 1, 2, 11, 1, NULL),
		  (2, 1, 1, 9, 1, NULL), (2, 2, 1, 4, 1, NULL),
		  (3, 1, 1, 3, 1, NULL),
		  (4, 6, 1, NULL, 2, NULL), (4, 6, 2, NULL, 1, 1);
		-- Claimant rate: refused on wards, and published there by nobody. Population: no route to wards but it is published there by another dataset.
		INSERT INTO series VALUES (5, 2, 1, 2, 'published', NULL, 'claimants/population');
		INSERT INTO conversion_skip VALUES
		  (2, 2, 1, 2, 'refused-measure', 1),
		  (1, 1, 1, 2, 'no-route', 1);
	`);
	return database;
};

const rows = (database: DatabaseSync, sql: string) =>
	(database.prepare(sql).all() as Array<Record<string, unknown>>).map(
		(row) => ({ ...row }),
	);

describe("writeSeriesCoverage", () => {
	test("counts the areas, the areas with a value and the release's areas for each series and period", () => {
		const database = fixture();
		const summary = writeSeriesCoverage(database);
		assert.deepEqual(
			rows(
				database,
				"SELECT * FROM series_coverage ORDER BY series_id, period_id",
			),
			[
				{
					series_id: 1,
					period_id: 1,
					areas: 3,
					areas_with_value: 2,
					release_areas: 4,
					countries: "E,S",
					default_areas: 3,
				},
				{
					series_id: 1,
					period_id: 2,
					areas: 1,
					areas_with_value: 1,
					release_areas: 4,
					countries: "E",
					default_areas: 1,
				},
				{
					series_id: 2,
					period_id: 1,
					areas: 2,
					areas_with_value: 2,
					release_areas: 4,
					countries: "E,W",
					default_areas: 0,
				},
				{
					series_id: 3,
					period_id: 1,
					areas: 1,
					areas_with_value: 1,
					release_areas: 4,
					countries: "E",
					default_areas: 0,
				},
				// A status-only row has no value, a category-only row has one. The
				// release covers Northern Ireland alone, so a code with no prefix is N.
				{
					series_id: 4,
					period_id: 1,
					areas: 1,
					areas_with_value: 0,
					release_areas: 1,
					countries: "",
					default_areas: 1,
				},
				{
					series_id: 4,
					period_id: 2,
					areas: 1,
					areas_with_value: 1,
					release_areas: 1,
					countries: "N",
					default_areas: 1,
				},
			],
		);
		assert.deepEqual(summary, { rows: 6, belowHalf: 3 });
	});

	test("fails when a series holds more areas than its release, naming it", () => {
		const database = fixture();
		database.exec("UPDATE area_version SET in_inventory = 0 WHERE id <> 1");
		assert.throws(
			() => writeSeriesCoverage(database),
			/census\/population 2021: 3 areas, release holds 1/,
		);
	});

	test("v_coverage reads one row for each series and period, with the method, default and conversion quality", () => {
		const database = fixture();
		writeSeriesCoverage(database);
		assert.deepEqual(
			rows(
				database,
				"SELECT measure, quantity, members, dataset, geography, release, period, period_kind, period_start, period_end, method, is_default, preference_rank, areas_with_value, release_areas, share, default_areas, default_share, countries, exact_share, coverage FROM v_coverage WHERE series_id IN (1, 2, 3) AND period = '2021' ORDER BY series_id",
			),
			[
				{
					measure: "population",
					quantity: "population/localAuthority:2024",
					members: null,
					dataset: "census",
					geography: "localAuthority",
					release: "2024",
					period: "2021",
					period_kind: "year",
					period_start: "2021-01-01",
					period_end: "2021-12-31",
					method: "published",
					is_default: 1,
					preference_rank: 1,
					areas_with_value: 2,
					release_areas: 4,
					share: 0.5,
					default_areas: 3,
					default_share: 0.75,
					countries: "E,S",
					exact_share: null,
					coverage: null,
				},
				{
					measure: "population",
					quantity: "population/localAuthority:2024",
					members: null,
					dataset: "census",
					geography: "localAuthority",
					release: "2024",
					period: "2021",
					period_kind: "year",
					period_start: "2021-01-01",
					period_end: "2021-12-31",
					method: "converted",
					is_default: 0,
					preference_rank: 2,
					areas_with_value: 2,
					release_areas: 4,
					share: 0.5,
					default_areas: 0,
					default_share: 0,
					countries: "E,W",
					exact_share: 0.75,
					coverage: 0.9,
				},
				// A part of a total is in no quantity, so it is nobody's default.
				{
					measure: "population",
					quantity: null,
					members: "age=16-24",
					dataset: "census",
					geography: "localAuthority",
					release: "2024",
					period: "2021",
					period_kind: "year",
					period_start: "2021-01-01",
					period_end: "2021-12-31",
					method: "published",
					is_default: 0,
					preference_rank: null,
					areas_with_value: 1,
					release_areas: 4,
					share: 0.25,
					default_areas: 0,
					default_share: 0,
					countries: "E",
					exact_share: null,
					coverage: null,
				},
			],
		);
	});

	test("a lower-ranked series is the default for a period the better one lacks", () => {
		const database = fixture();
		database.exec(`
			INSERT INTO period VALUES (3, '2023', 'year', '2023-01-01', '2023-12-31');
			INSERT INTO observation VALUES (2, 1, 3, 8, 1, NULL), (2, 2, 3, 7, 1, NULL), (2, 4, 3, 6, 1, NULL);`);
		writeSeriesCoverage(database);
		assert.deepEqual(
			rows(
				database,
				"SELECT series_id, period, is_default, preference_rank, default_areas, default_share FROM v_coverage WHERE series_id IN (1, 2) ORDER BY period, series_id",
			),
			[
				// 2021: series 1 holds three areas, so series 2 takes none, even though it has two.
				{
					series_id: 1,
					period: "2021",
					is_default: 1,
					preference_rank: 1,
					default_areas: 3,
					default_share: 0.75,
				},
				{
					series_id: 2,
					period: "2021",
					is_default: 0,
					preference_rank: 2,
					default_areas: 0,
					default_share: 0,
				},
				{
					series_id: 1,
					period: "2022",
					is_default: 1,
					preference_rank: 1,
					default_areas: 1,
					default_share: 0.25,
				},
				// 2023: only series 2 has a row, so it is the default for all three areas.
				{
					series_id: 2,
					period: "2023",
					is_default: 1,
					preference_rank: 2,
					default_areas: 3,
					default_share: 0.75,
				},
			],
		);
	});

	test("a lower-ranked series is the default only for the areas the better one misses", () => {
		const database = fixture();
		// 2022: series 1 holds area 1. Series 2 holds areas 1, 2 and 4, so it wins 2 and 4.
		database.exec(
			"INSERT INTO observation VALUES (2, 1, 2, 12, 1, NULL), (2, 2, 2, 5, 1, NULL), (2, 4, 2, 3, 1, NULL)",
		);
		writeSeriesCoverage(database);
		assert.deepEqual(
			rows(
				database,
				"SELECT series_id, is_default, areas, default_areas, default_share FROM v_coverage WHERE period = '2022' AND series_id IN (1, 2) ORDER BY series_id",
			),
			[
				{
					series_id: 1,
					is_default: 1,
					areas: 1,
					default_areas: 1,
					default_share: 0.25,
				},
				{
					series_id: 2,
					is_default: 1,
					areas: 3,
					default_areas: 2,
					default_share: 0.5,
				},
			],
		);
		// Every area of the default view has one series: the counts add up to its rows.
		assert.equal(
			rows(
				database,
				"SELECT sum(default_areas) AS n FROM series_coverage WHERE series_id IN (1, 2) AND period_id = 2",
			)[0]!.n,
			3,
		);
	});

	test("a NULL-valued row of the better series keeps its area", () => {
		const database = fixture();
		writeSeriesCoverage(database);
		// Series 1 has a NULL value for area 2 in 2021, and series 2 has a value there.
		assert.deepEqual(
			rows(
				database,
				"SELECT series_id, areas, default_areas FROM v_coverage WHERE period = '2021' AND series_id IN (1, 2) ORDER BY series_id",
			),
			[
				{ series_id: 1, areas: 3, default_areas: 3 },
				{ series_id: 2, areas: 2, default_areas: 0 },
			],
		);
	});

	test("a series in no quantity is the default for no area", () => {
		const database = fixture();
		writeSeriesCoverage(database);
		assert.deepEqual(
			rows(
				database,
				"SELECT is_default, default_areas, default_share FROM v_coverage WHERE series_id = 3",
			),
			[{ is_default: 0, default_areas: 0, default_share: 0 }],
		);
	});

	test("v_coverage_missing lists a considered combination with no series, and why", () => {
		const database = fixture();
		writeSeriesCoverage(database);
		// Population is on wards through another dataset's series 5, so only the
		// refused measure is missing there.
		assert.deepEqual(
			rows(
				database,
				"SELECT measure, geography, release, reason, explanation, dataset, source_geography, source_release, source_series FROM v_coverage_missing",
			),
			[
				{
					measure: "claimant-rate",
					geography: "ward",
					release: "2024",
					reason: "refused-measure",
					explanation: "The 16 to 64 population is not held.",
					dataset: "claimants",
					source_geography: "localAuthority",
					source_release: "2024",
					source_series: 1,
				},
			],
		);
	});
});
