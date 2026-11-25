import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "vitest";
import { writeAreaPeriodChange } from "../../src/storage/areaPeriodChange.ts";
import { ensureRateTables } from "../../src/storage/countRates.ts";

/**
 * Two local authority releases, the earlier one an old edition and the later
 * one the standard release, and one MSOA release, which is compared on its
 * own boundaries. E06000001 is on both local authority releases and moved
 * between them; E06000060 is only on the later one.
 */
const fixture = (extra = "") => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE unit (id INTEGER PRIMARY KEY, kind TEXT);
		CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT, statistic TEXT, unit_id INTEGER);
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT, kind TEXT, start_date TEXT, end_date TEXT);
		CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER, name TEXT);
		CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT, derived_from_id INTEGER);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE series_input (series_id INTEGER, input_series_id INTEGER, role TEXT);
		CREATE TABLE series_estimate (series_id INTEGER, area_version_id INTEGER, period_id INTEGER);
		CREATE TABLE quantity (id INTEGER PRIMARY KEY, measure_id INTEGER, release_id INTEGER, key TEXT);
		CREATE TABLE series_preference (series_id INTEGER PRIMARY KEY, quantity_id INTEGER, rank INTEGER);
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, PRIMARY KEY (series_id, area_version_id, period_id));
		CREATE TABLE area_change_extent (from_version_id INTEGER, to_version_id INTEGER, successor TEXT, residents_lost REAL, residents_gained REAL, land_lost REAL, land_gained REAL);

		INSERT INTO unit VALUES (1, 'count'), (2, 'currency'), (3, 'percent');
		INSERT INTO measure VALUES
		  (1, 'population', 'count', 1), (2, 'households', 'count', 1),
		  (3, 'imd-rank', 'rank', 1), (4, 'gross-annual-pay', 'median', 2),
		  (5, 'employment-rate', 'rate', 3), (6, 'gross-annual-pay-change', 'change', 3);
		INSERT INTO dataset VALUES (1, 'mye'), (2, 'income'), (3, 'imd');
		INSERT INTO area_release VALUES
		  (1, 'localAuthority', '2019-12-uk-bgc'), (2, 'localAuthority', '2026-05-uk-bgc'), (3, 'msoa', '2021-12-ew-bgc');
		INSERT INTO period VALUES
		  (1, '2019', 'year', '2019-01-01', '2019-12-31'), (2, '2020', 'year', '2020-01-01', '2020-12-31'),
		  (3, '2021', 'year', '2021-01-01', '2021-12-31'), (4, '2022', 'year', '2022-01-01', '2022-12-31');
		INSERT INTO area VALUES (1, 'E06000001'), (2, 'E06000060'), (3, 'E02000001');
		INSERT INTO area_version VALUES
		  (10, 1, 1, 'Hartlepool'), (20, 1, 2, 'Hartlepool'), (21, 2, 2, 'Buckinghamshire'), (30, 3, 3, 'City of London 001');
		-- E06000001 moved: 8% of its later residents were not in it before.
		INSERT INTO area_change_extent VALUES (10, 20, 'same-code', 0.02, 0.08, NULL, NULL);

		-- Population: 2019 published on the old release, converted onto the
		-- standard one; 2020 and 2021 published on the standard one.
		INSERT INTO series VALUES
		  (1, 1, 1, 1, 'published', NULL), (2, 1, 1, 2, 'converted', 1), (3, 1, 1, 2, 'published', NULL);
		INSERT INTO series_input VALUES (2, 1, 'value');
		INSERT INTO quantity VALUES (1, 1, 2, 'population');
		INSERT INTO series_preference VALUES (3, 1, 1), (2, 1, 2);
		INSERT INTO observation VALUES
		  (1, 10, 1, 100), (2, 20, 1, 110), (2, 21, 1, 50),
		  (3, 20, 2, 120), (3, 20, 3, 130), (3, 21, 2, 55);
		INSERT INTO series_estimate VALUES (2, 21, 1);

		-- Households: 2019 was published only in two parts, converted as their sum.
		INSERT INTO series VALUES
		  (4, 1, 2, 1, 'published', NULL), (5, 1, 2, 1, 'published', NULL),
		  (6, 1, 2, 2, 'converted', 4), (7, 1, 2, 2, 'published', NULL);
		INSERT INTO series_member VALUES (4, 1, 1), (5, 1, 2);
		INSERT INTO series_input VALUES (6, 4, 'value'), (6, 5, 'value');
		INSERT INTO quantity VALUES (2, 2, 2, 'households');
		INSERT INTO series_preference VALUES (7, 2, 1), (6, 2, 2);
		INSERT INTO observation VALUES (4, 10, 1, 30), (5, 10, 1, 40), (6, 20, 1, 72), (7, 20, 2, 80);

		-- A rank and a change: never compared.
		INSERT INTO series VALUES (8, 3, 3, 2, 'published', NULL), (12, 2, 6, 2, 'published', NULL);
		INSERT INTO quantity VALUES (3, 3, 2, 'imd-rank'), (6, 6, 2, 'gross-annual-pay-change');
		INSERT INTO series_preference VALUES (8, 3, 1), (12, 6, 1);
		INSERT INTO observation VALUES (8, 20, 1, 5), (8, 20, 2, 7), (12, 20, 1, 1), (12, 20, 2, 2);

		-- Pay across ASHE's 2020 to 2021 breaks.
		INSERT INTO series VALUES (9, 2, 4, 2, 'published', NULL);
		INSERT INTO quantity VALUES (4, 4, 2, 'gross-annual-pay');
		INSERT INTO series_preference VALUES (9, 4, 1);
		INSERT INTO observation VALUES (9, 20, 1, 30000), (9, 20, 2, 31000), (9, 20, 3, 32000);

		-- A percentage on the MSOA release, and the old release, which is not a target.
		INSERT INTO series VALUES (10, 1, 5, 3, 'published', NULL), (11, 3, 1, 1, 'published', NULL);
		INSERT INTO quantity VALUES (5, 5, 3, 'employment-rate'), (7, 1, 1, 'population');
		INSERT INTO series_preference VALUES (10, 5, 1), (11, 7, 1);
		INSERT INTO observation VALUES (10, 30, 1, 70), (10, 30, 2, 72.5), (11, 10, 1, 1), (11, 10, 2, 2);
	`);
	ensureRateTables(database);
	database.exec(extra);
	const summary = writeAreaPeriodChange(database);
	return { database, summary };
};

type Row = Record<string, string | number | null>;

const rows = (database: DatabaseSync, where: string) =>
	database
		.prepare(
			`SELECT * FROM v_area_period_change WHERE ${where} ORDER BY from_period, to_period`,
		)
		.all() as Row[];

describe("writeAreaPeriodChange", () => {
	test("pairs each period with the next, and the first with the latest", () => {
		const { database } = fixture();
		const pairs = rows(
			database,
			"measure = 'population' AND area_code = 'E06000001'",
		).map((row) => [row.from_period, row.to_period, row.span]);
		assert.deepEqual(pairs, [
			["2019", "2020", "adjacent"],
			["2019", "2021", "first-latest"],
			["2020", "2021", "adjacent"],
		]);
		// Two periods only: no first-to-latest pair repeats the adjacent one.
		assert.equal(
			rows(database, "measure = 'population' AND area_code = 'E06000060'")
				.length,
			1,
		);
	});

	test("leaves out ranks, changes and releases that are not targets", () => {
		const { database } = fixture();
		const measures = database
			.prepare(
				"SELECT DISTINCT measure, release FROM v_area_period_change ORDER BY 1, 2",
			)
			.all()
			.map((row) => `${row.measure} ${row.release}`);
		assert.deepEqual(measures, [
			"employment-rate 2021-12-ew-bgc",
			"gross-annual-pay 2026-05-uk-bgc",
			"households 2026-05-uk-bgc",
			"population 2026-05-uk-bgc",
		]);
	});

	test("compares the fixed-boundary change with the change as published", () => {
		const { database } = fixture();
		const [row] = rows(
			database,
			"measure = 'population' AND area_code = 'E06000001' AND to_period = '2020'",
		);
		assert.equal(row!.change, 10);
		assert.equal(row!.percent_change, 100 * (10 / 110));
		assert.equal(row!.from_accuracy, "regrouped");
		assert.equal(row!.to_accuracy, "published");
		assert.equal(row!.accuracy, "regrouped");
		assert.equal(row!.boundary_check, "published");
		assert.equal(row!.from_published_value, 100);
		assert.equal(row!.published_change, 20);
		assert.equal(row!.boundary_effect, 10);
		assert.equal(row!.materially_changed, 1);
		assert.equal(row!.residents_gained, 0.08);
		assert.equal(row!.land_lost, null);
		assert.equal(row!.from_published_version_id, 10);
		assert.equal(row!.to_published_version_id, 20);
	});

	test("both ends on these boundaries have no boundary effect", () => {
		const { database } = fixture();
		const [row] = rows(
			database,
			"measure = 'population' AND area_code = 'E06000001' AND from_period = '2020'",
		);
		assert.equal(row!.boundary_effect, 0);
		assert.equal(row!.materially_changed, 0);
		assert.equal(row!.residents_lost, 0);
	});

	test("says when the code was not published rather than guessing", () => {
		const { database } = fixture();
		const [row] = rows(
			database,
			"measure = 'population' AND area_code = 'E06000060'",
		);
		assert.equal(row!.from_accuracy, "estimated");
		assert.equal(row!.boundary_check, "code-not-published");
		assert.equal(row!.published_change, null);
		assert.equal(row!.boundary_effect, null);
		assert.equal(row!.materially_changed, null);
	});

	test("sums published parts where no published total exists", () => {
		const { database } = fixture();
		assert.deepEqual(
			{
				...database
					.prepare(
						"SELECT * FROM series_published_counterpart WHERE series_id = 6",
					)
					.get(),
			},
			{
				series_id: 6,
				published_series_id: null,
				release_id: 1,
				parts: 2,
			},
		);
		const [row] = rows(database, "measure = 'households'");
		assert.equal(row!.published_from_parts, 1);
		assert.equal(row!.from_published_value, 70);
		assert.equal(row!.change, 8);
		assert.equal(row!.boundary_effect, 2);
	});

	test("lists the method breaks a change crosses", () => {
		const { database } = fixture();
		const breaks = rows(database, "measure = 'gross-annual-pay'").map(
			(row) => [row.from_period, row.to_period, row.breaks],
		);
		assert.deepEqual(breaks, [
			["2019", "2020", "sample 2020"],
			["2019", "2021", "classification 2021; sample 2021"],
			["2020", "2021", "sample 2020; classification 2021; sample 2021"],
		]);
		const [first] = rows(database, "measure = 'gross-annual-pay'");
		assert.equal(
			first!.break_notes,
			"Estimates for 2020 come from a smaller sample, include furloughed employees and carry more uncertainty than usual.",
		);
		assert.equal(
			rows(database, "measure = 'population'").every(
				(row) => row.breaks === null,
			),
			true,
		);
	});

	test("a percentage changes in points, with no percent change", () => {
		const { database } = fixture();
		const [row] = rows(database, "measure = 'employment-rate'");
		assert.equal(row!.change, 2.5);
		assert.equal(row!.percent_change, null);
		assert.equal(row!.boundary_check, "published");
		assert.equal(row!.boundary_effect, 0);
	});

	test("summarises what it wrote", () => {
		const { summary } = fixture();
		assert.deepEqual(summary, {
			rows: 9,
			counterparts: 2,
			spans: 1,
			breaks: 3,
		});
	});

	test("a rebuilt rate's end takes the accuracy of its worse input", () => {
		const { database } = fixture(`
			INSERT INTO measure VALUES (7, 'claimant-rate', 'rate', 3);
			INSERT INTO series VALUES (13, 1, 7, 2, 'derived', 3);
			INSERT INTO quantity VALUES (8, 7, 2, 'claimant-rate');
			INSERT INTO series_preference VALUES (13, 8, 1);
			INSERT INTO observation VALUES (13, 20, 1, 2.5), (13, 20, 2, 3);
			INSERT INTO rate_input VALUES
			  (13, 20, 1, 5, 200, 1, 1, 0, 'published', 'estimated', 'estimated'),
			  (13, 20, 2, 6, 200, 1, 1, 1, 'published', 'regrouped', 'regrouped');
		`);
		const [row] = rows(
			database,
			"measure = 'claimant-rate' AND area_code = 'E06000001'",
		);
		assert.equal(row!.from_accuracy, "estimated");
		assert.equal(row!.to_accuracy, "regrouped");
		assert.equal(row!.accuracy, "estimated");
	});
});
