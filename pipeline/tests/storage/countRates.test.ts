import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "vitest";
import { COUNT_DENOMINATORS, REBUILT_RATES } from "@uk-data-atlas/datasets";
import {
	denominatorFor,
	midpointYear,
	writeCountRates,
} from "../../src/storage/countRates.ts";

/**
 * One local authority release with an English, a Scottish and a Northern
 * Irish authority, and an English one with no population. Ages run 0 to 5, so
 * the claimant rate here is over ages 2 to 3.
 *
 * - E1 (10): claimants 30 in 2025. Its age series are held by `population`
 *   (2025, ages 2 and 3: 400 + 200) and by `population-uk` (other values),
 *   so the dataset order picks `population`. The default view's all-ages
 *   total for 2025 is from `imd`, which is skipped: crimes fall back to the
 *   2024 total.
 * - S1 (11): claimants 12 in 2025, ages from `population-council-scotland`.
 * - N1 (12): claimants 9 in 2025, ages held only for 2024: an earlier year.
 * - E2 (13): claimants 5, only age 2 held: no denominator.
 */
const fixture = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
		CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT, kind TEXT, start_date TEXT, end_date TEXT);
		CREATE TABLE status (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dimension (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, dimension_id INTEGER, code TEXT);
		CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT, derived_from_id INTEGER, key TEXT UNIQUE);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE series_input (series_id INTEGER, input_series_id INTEGER, role TEXT, PRIMARY KEY (series_id, input_series_id));
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, status_id INTEGER, PRIMARY KEY (series_id, area_version_id, period_id));
		CREATE TABLE quantity (id INTEGER PRIMARY KEY, measure_id INTEGER, release_id INTEGER, key TEXT);
		CREATE TABLE series_preference (series_id INTEGER PRIMARY KEY, quantity_id INTEGER, rank INTEGER);

		INSERT INTO measure VALUES (1, 'claimants'), (2, 'claimant-rate'), (3, 'population'),
		  (4, 'recorded-crimes'), (5, 'recorded-crimes-per-1000-residents');
		INSERT INTO dataset VALUES (1, 'claimant-count'), (2, 'population'), (3, 'population-uk'),
		  (4, 'population-council-scotland'), (5, 'population-district-ni'), (6, 'imd'), (7, 'crime');
		INSERT INTO area_release VALUES (1, 'localAuthority', '2026-05-uk-bgc');
		INSERT INTO area_version VALUES (10, 1, 1), (11, 2, 1), (12, 3, 1), (13, 4, 1);
		INSERT INTO period VALUES
		  (1, '2024', 'year', '2024-01-01', '2024-12-31'), (2, '2025', 'year', '2025-01-01', '2025-12-31'),
		  (3, '2025-06', 'month', '2025-06-01', '2025-06-30'),
		  (4, 'year-ending-2026-03', 'range', '2025-04-01', '2026-03-31');
		INSERT INTO status VALUES (1, 'observed'), (2, 'estimated'), (6, 'derived');
		INSERT INTO dimension VALUES (1, 'age'), (2, 'sex');
		INSERT INTO dimension_member VALUES (100, 1, '0'), (101, 1, '1'), (102, 1, '2'), (103, 1, '3'),
		  (104, 1, '4'), (105, 1, '5'), (110, 1, 'total'), (200, 2, 'all'), (201, 2, 'female');

		-- Claimants, the winners of their quantity.
		INSERT INTO series VALUES (1, 1, 1, 1, 'published', NULL, 'claimants/la');
		INSERT INTO quantity VALUES (1, 1, 1, 'claimants/localAuthority:2026-05-uk-bgc');
		INSERT INTO series_preference VALUES (1, 1, 1);
		INSERT INTO observation VALUES (1, 10, 3, 30, 1), (1, 11, 3, 12, 1), (1, 12, 3, 9, 1), (1, 13, 3, 5, 1);

		-- Single years of age, sex all.
		INSERT INTO series VALUES
		  (20, 2, 3, 1, 'published', NULL, 'pop/age=2'), (21, 2, 3, 1, 'published', NULL, 'pop/age=3'),
		  (22, 3, 3, 1, 'published', NULL, 'uk/age=2'), (23, 3, 3, 1, 'published', NULL, 'uk/age=3'),
		  (24, 4, 3, 1, 'published', NULL, 'sc/age=2'), (25, 4, 3, 1, 'published', NULL, 'sc/age=3'),
		  (26, 5, 3, 1, 'published', NULL, 'ni/age=2'), (27, 5, 3, 1, 'published', NULL, 'ni/age=3'),
		  (28, 2, 3, 1, 'published', NULL, 'pop/age=2/sex=female');
		INSERT INTO series_member VALUES
		  (20, 1, 102), (20, 2, 200), (21, 1, 103), (21, 2, 200),
		  (22, 1, 102), (22, 2, 200), (23, 1, 103), (23, 2, 200),
		  (24, 1, 102), (24, 2, 200), (25, 1, 103), (25, 2, 200),
		  (26, 1, 102), (26, 2, 200), (27, 1, 103), (27, 2, 200),
		  (28, 1, 102), (28, 2, 201);
		INSERT INTO observation VALUES
		  (20, 10, 2, 400, 1), (21, 10, 2, 200, 1), (20, 13, 2, 50, 1),
		  (22, 10, 2, 999, 1), (23, 10, 2, 999, 1),
		  (24, 11, 2, 150, 1), (25, 11, 2, 90, 2),
		  (26, 12, 1, 100, 1), (27, 12, 1, 80, 1),
		  (28, 10, 2, 1, 1);

		-- The all-ages total: imd wins 2025 for E1, the population dataset holds 2024.
		INSERT INTO series VALUES (30, 6, 3, 1, 'published', NULL, 'imd/pop'), (31, 2, 3, 1, 'converted', 20, 'pop/total~converted');
		INSERT INTO quantity VALUES (3, 3, 1, 'population/localAuthority:2026-05-uk-bgc');
		INSERT INTO series_preference VALUES (30, 3, 1), (31, 3, 2);
		INSERT INTO observation VALUES (30, 10, 2, 5000, 1), (31, 10, 2, 5100, 6), (31, 10, 1, 4000, 6), (31, 11, 1, 2000, 2);

		-- Crimes in the year to March 2026: the middle is in 2025.
		INSERT INTO series VALUES (40, 7, 4, 1, 'published', NULL, 'crimes/la');
		INSERT INTO quantity VALUES (4, 4, 1, 'recorded-crimes/localAuthority:2026-05-uk-bgc');
		INSERT INTO series_preference VALUES (40, 4, 1);
		INSERT INTO observation VALUES (40, 10, 4, 120, 1), (40, 11, 4, 30, 1), (40, 12, 4, 7, 1);
	`);
	return database;
};

const rates: typeof REBUILT_RATES = new Map([
	[
		"claimant-rate",
		{
			numerator: "claimants",
			denominator: {
				measure: "population",
				filter: { age: { from: 2, to: 3 } },
				label: "residents aged 2 to 3",
			},
			per: 100,
		},
	],
	[
		"recorded-crimes-per-1000-residents",
		{
			numerator: "recorded-crimes",
			denominator: { measure: "population", filter: {}, label: "all" },
			per: 1000,
		},
	],
]);

/** Series ids past the fixture's. */
const ids = () => {
	let next = 1000;
	return { series: { assign: () => next++ } };
};

type Input = {
	area: number;
	value: number;
	numerator: number;
	denominator: number;
	dataset: string;
	period: string;
	earlier: number;
	accuracy: string;
	denominator_accuracy: string;
};

const written = (database: DatabaseSync, measure: string) =>
	database
		.prepare(
			`SELECT o.area_version_id AS area, o.value, r.numerator, r.denominator, d.slug AS dataset,
			   p.label AS period, r.earlier_year AS earlier, r.accuracy, r.denominator_accuracy
			 FROM series s JOIN observation o ON o.series_id = s.id
			 JOIN rate_input r ON r.series_id = s.id AND r.area_version_id = o.area_version_id AND r.period_id = o.period_id
			 JOIN dataset d ON d.id = r.denominator_dataset_id JOIN period p ON p.id = r.denominator_period_id
			 WHERE s.method = 'derived' AND s.measure_id = (SELECT id FROM measure WHERE slug = ?)
			 ORDER BY o.area_version_id`,
		)
		.all(measure) as Input[];

describe("writeCountRates", () => {
	test("the claimant rate covers Scotland and Northern Ireland from their own age series", () => {
		const database = fixture();
		const [claimants] = writeCountRates(database, ids(), rates);
		const rows = written(database, "claimant-rate");
		assert.deepEqual(
			rows.map((row) => [row.area, row.dataset, row.denominator]),
			[
				[10, "population", 600],
				[11, "population-council-scotland", 240],
				[12, "population-district-ni", 180],
			],
		);
		assert.equal(rows[0]!.value, 5);
		assert.equal(rows[1]!.value, 5);
		assert.deepEqual(claimants, {
			rate: "claimant-rate",
			series: 1,
			values: 3,
			earlier: 1,
			unmatched: 1,
		});
	});

	test("a missing year falls back to the latest earlier one and says so", () => {
		const database = fixture();
		writeCountRates(database, ids(), rates);
		const [, scotland, ni] = written(database, "claimant-rate");
		assert.equal(scotland!.earlier, 0);
		assert.deepEqual([ni!.period, ni!.earlier], ["2024", 1]);
		const years = new Map([
			[2022, "a"],
			[2024, "b"],
			[2026, "c"],
		]) as unknown as Parameters<typeof denominatorFor>[0];
		assert.equal(denominatorFor(years, 2025)?.year, 2024);
		assert.equal(denominatorFor(years, 2021), undefined);
	});

	test("an all-ages rate skips a total filed under the wrong year", () => {
		const database = fixture();
		writeCountRates(database, ids(), rates);
		const rows = written(database, "recorded-crimes-per-1000-residents");
		// E1's 2025 total is imd's, so 2024 is used; S1 has only 2024; N1 none.
		assert.deepEqual(
			rows.map((row) => [row.area, row.period, row.earlier, row.value]),
			[
				[10, "2024", 1, 30],
				[11, "2024", 1, 15],
			],
		);
		assert.equal(midpointYear("2025-04-01", "2026-03-31"), 2025);
	});

	test("the rate carries the worse accuracy of its two inputs", () => {
		const database = fixture();
		writeCountRates(database, ids(), rates);
		const crimes = written(database, "recorded-crimes-per-1000-residents");
		// A converted regrouping and a converted estimate of the population.
		assert.deepEqual(
			crimes.map((row) => [row.denominator_accuracy, row.accuracy]),
			[
				["regrouped", "regrouped"],
				["estimated", "estimated"],
			],
		);
		// One of the Scottish ages is an estimate on a published series.
		const [, scotland] = written(database, "claimant-rate");
		assert.equal(scotland!.accuracy, "published");
	});

	test("a larger area's rate is the sum of its counts over the sum of its denominators", () => {
		// Two parts with rates 10% (10 of 100) and 50% (50 of 100) average to
		// 30%; merged, the area is 60 of 200, also 30%. With 10 of 100 and 50
		// of 300 the average is 13.3% but the area is 60 of 400: 15%.
		const database = fixture();
		database.exec(`
			INSERT INTO area_version VALUES (14, 5, 1);
			INSERT INTO observation VALUES (1, 14, 3, 60, 6), (20, 14, 2, 100, 1), (21, 14, 2, 300, 1);
		`);
		writeCountRates(database, ids(), rates);
		const merged = written(database, "claimant-rate").find(
			(row) => row.area === 14,
		)!;
		assert.equal(merged.value, 15);
		assert.notEqual(merged.value, (10 / 100 + 50 / 300) * 50);
	});

	test("each rate series is derived from its numerator and names its inputs", () => {
		const database = fixture();
		writeCountRates(database, ids(), rates);
		const series = database
			.prepare(
				"SELECT id, method, derived_from_id, key FROM series WHERE method = 'derived' ORDER BY key",
			)
			.all() as Array<{
			id: number;
			derived_from_id: number;
			key: string;
		}>;
		assert.deepEqual(
			series.map((row) => [row.key, row.derived_from_id]),
			[
				["claimants/la~rate:claimant-rate", 1],
				["crimes/la~rate:recorded-crimes-per-1000-residents", 40],
			],
		);
		const inputs = database
			.prepare(
				"SELECT input_series_id AS input, role FROM series_input WHERE series_id = ? ORDER BY input_series_id",
			)
			.all(series[0]!.id)
			.map((row) => `${row.input} ${row.role}`);
		assert.deepEqual(inputs, [
			"1 numerator",
			"20 denominator",
			"21 denominator",
			"24 denominator",
			"25 denominator",
			"26 denominator",
			"27 denominator",
		]);
	});

	test("a count with no denominator has no rate", () => {
		const entry = COUNT_DENOMINATORS["area"]!;
		assert.equal(entry.kind, "none");
		assert.ok(
			![...REBUILT_RATES.values()].some(
				(rate) => rate.numerator === "area",
			),
		);
		const database = fixture();
		const summaries = writeCountRates(database, ids());
		assert.deepEqual(
			summaries.map((summary) => summary.rate),
			["claimant-rate", "recorded-crimes-per-1000-residents"],
		);
	});
});
