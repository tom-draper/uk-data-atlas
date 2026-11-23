import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * The coverage table and views in the built `atlas.sqlite`
 * (`pnpm data:build --only assemble-atlas`): what exists for a measure,
 * geography, release and period, by which method, and how complete it is.
 */
const ATLAS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build/atlas.sqlite",
);
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

const all = (sql: string) =>
	(database.prepare(sql).all() as Array<Record<string, unknown>>).map(
		(row) => ({ ...row }),
	);
const one = (sql: string) => Number(all(sql)[0]!.n);

test("every series and period of observation has exactly one coverage row, and no other does", () => {
	// series_coverage is keyed by (series_id, period_id), so no pair has two.
	assert.deepEqual(
		all(`SELECT o.series_id, o.period_id
			 FROM (SELECT DISTINCT series_id, period_id FROM observation) o
			 WHERE NOT EXISTS (
			   SELECT 1 FROM series_coverage c
			   WHERE c.series_id = o.series_id AND c.period_id = o.period_id)`),
		[],
	);
	assert.deepEqual(
		all(`SELECT c.series_id, c.period_id FROM series_coverage c
			 WHERE NOT EXISTS (
			   SELECT 1 FROM observation o
			   WHERE o.series_id = c.series_id AND o.period_id = c.period_id)`),
		[],
	);
	assert.equal(
		one("SELECT count(*) AS n FROM series_coverage"),
		one(
			"SELECT count(*) AS n FROM (SELECT DISTINCT series_id, period_id FROM observation)",
		),
	);
});

test("the counts nest: areas with a value, then areas, then the release's areas", () => {
	assert.deepEqual(
		all(`SELECT s.key, p.label, c.areas_with_value, c.areas, c.release_areas
			 FROM series_coverage c
			 JOIN series s ON s.id = c.series_id
			 JOIN period p ON p.id = c.period_id
			 WHERE c.areas_with_value > c.areas OR c.areas > c.release_areas
			    OR c.areas_with_value < 0 LIMIT 20`),
		[],
	);
});

test("the counts match the observations for the series of one measure", () => {
	assert.deepEqual(
		all(`SELECT c.series_id, c.period_id, c.areas, n.areas AS counted
			 FROM series_coverage c
			 JOIN (SELECT o.series_id, o.period_id, count(*) AS areas,
			              sum(o.value IS NOT NULL OR o.category_id IS NOT NULL) AS with_value
			       FROM observation o
			       WHERE o.series_id IN (
			         SELECT s.id FROM series s JOIN measure m ON m.id = s.measure_id
			         WHERE m.slug IN ('population', 'gross-annual-pay'))
			       GROUP BY o.series_id, o.period_id) n
			   ON n.series_id = c.series_id AND n.period_id = c.period_id
			 WHERE n.areas <> c.areas OR n.with_value <> c.areas_with_value`),
		[],
	);
});

test("release_areas is the number of areas in the series' release inventory", () => {
	assert.deepEqual(
		all(`SELECT c.series_id FROM series_coverage c
			 JOIN series s ON s.id = c.series_id
			 WHERE c.release_areas <> (
			   SELECT count(*) FROM area_version v
			   WHERE v.release_id = s.release_id AND v.in_inventory = 1)`),
		[],
	);
});

test("countries is a sorted list of nations, empty only where no area has a value", () => {
	assert.deepEqual(
		all(`SELECT DISTINCT countries FROM series_coverage
			 WHERE countries NOT IN ('', 'E', 'N', 'S', 'W', 'E,N', 'E,S', 'E,W', 'N,S', 'N,W', 'S,W',
			   'E,N,S', 'E,N,W', 'E,S,W', 'N,S,W', 'E,N,S,W', '?')`),
		[],
	);
	assert.deepEqual(
		all(`SELECT series_id, period_id FROM series_coverage
			 WHERE (countries = '') <> (areas_with_value = 0)`),
		[],
	);
	// A local authority release on England, Wales and Scotland is never read as England alone.
	assert.ok(
		one(
			"SELECT count(*) AS n FROM series_coverage WHERE countries LIKE '%W%'",
		) > 0,
	);
});

test("v_coverage has one row for each series_coverage row, and the rank 1 series of a quantity is always a default", () => {
	assert.equal(
		one("SELECT count(*) AS n FROM v_coverage"),
		one("SELECT count(*) AS n FROM series_coverage"),
	);
	// A rank 1 series takes every area it has, and a series in no quantity none.
	assert.deepEqual(
		all(`SELECT v.series_id FROM v_coverage v
			 JOIN series_preference sp ON sp.series_id = v.series_id
			 WHERE v.preference_rank <> sp.rank
			    OR (sp.rank = 1 AND (v.is_default <> 1 OR v.default_areas <> v.areas))`),
		[],
	);
	assert.deepEqual(
		all(`SELECT series_id FROM v_coverage
			 WHERE (quantity IS NULL AND default_areas <> 0)
			    OR is_default <> (default_areas > 0)
			    OR default_areas > areas`),
		[],
	);
	// Quality columns exist for a converted series and for no other.
	assert.deepEqual(
		all(`SELECT DISTINCT series_id FROM v_coverage
			 WHERE (method = 'converted') <> (exact_share IS NOT NULL AND coverage IS NOT NULL)`),
		[],
	);
});

test("v_coverage answers a filter on measure, geography and period without a slow read", () => {
	const started = performance.now();
	const rows = all(
		"SELECT period, method, share, countries FROM v_coverage WHERE measure = 'population' AND geography = 'localAuthority' ORDER BY release, period",
	);
	assert.ok(rows.length > 0);
	assert.ok(performance.now() - started < 1000);
});

test("v_coverage_missing gives a reason and no combination that has a series", () => {
	assert.ok(
		one("SELECT count(*) AS n FROM v_coverage_missing") > 0,
		"the release has skipped conversions",
	);
	assert.deepEqual(
		all(`SELECT DISTINCT m.measure, m.geography, m.release FROM v_coverage_missing m
			 WHERE EXISTS (
			   SELECT 1 FROM v_coverage c
			   WHERE c.measure = m.measure AND c.geography = m.geography AND c.release = m.release)`),
		[],
	);
	assert.deepEqual(
		all(
			`SELECT * FROM v_coverage_missing WHERE explanation IS NULL OR explanation = ''`,
		),
		[],
	);
	// A refused measure carries the reason the measure cannot be converted.
	assert.deepEqual(
		all(`SELECT reason, explanation FROM v_coverage_missing
			 WHERE reason = 'refused-measure' AND explanation LIKE 'The measure is not converted%'`),
		[],
	);
});

test("the worked answers hold", () => {
	assert.deepEqual(
		all(`SELECT period, method FROM v_coverage
			 WHERE measure = 'population' AND geography = 'localAuthority'
			   AND release = '2026-05-uk-bgc' AND members IS NULL
			 ORDER BY period, preference_rank`),
		[
			{ period: "2015", method: "converted" },
			{ period: "2019", method: "converted" },
			{ period: "2021", method: "converted" },
			{ period: "2022", method: "converted" },
			{ period: "2025", method: "converted" },
		],
	);
	assert.deepEqual(
		all(`SELECT DISTINCT geography FROM v_coverage
			 WHERE measure = 'gross-annual-pay' AND members LIKE '%pay-statistic=median%'
			 ORDER BY geography`),
		[
			{ geography: "country" },
			{ geography: "countyAndUnitaryAuthority" },
			{ geography: "localAuthority" },
			{ geography: "region" },
		],
	);
	assert.deepEqual(
		all(`SELECT DISTINCT reason FROM v_coverage_missing
			 WHERE measure = 'claimant-rate' AND geography = 'ward'`),
		[{ reason: "refused-measure" }],
	);
});

test("the areas the default view takes from each series add up to its rows for each period", () => {
	// The population of a ward or a local authority draws on several series,
	// period by period and area by area.
	for (const where of [
		"geography = 'ward'",
		"geography = 'localAuthority' AND release = '2026-05-uk-bgc'",
	]) {
		assert.deepEqual(
			all(`WITH covered AS (
				   SELECT quantity, period, sum(default_areas) AS n
				   FROM v_coverage
				   WHERE measure = 'population' AND ${where}
				   GROUP BY quantity, period),
				 rows AS (
				   SELECT quantity, period, count(*) AS n
				   FROM v_observation_default
				   WHERE measure = 'population' AND ${where}
				   GROUP BY quantity, period)
			   SELECT coalesce(c.quantity, r.quantity) AS quantity,
			     coalesce(c.period, r.period) AS period, c.n AS covered, r.n AS rows
			   FROM covered c FULL JOIN rows r ON r.quantity = c.quantity AND r.period = c.period
			   WHERE coalesce(c.n, 0) <> coalesce(r.n, 0)`),
			[],
			where,
		);
		assert.ok(
			one(
				`SELECT count(*) AS n FROM v_coverage WHERE measure = 'population' AND ${where} AND is_default = 1 AND preference_rank > 1`,
			) > 0,
			`${where}: some period is supplied by a series other than rank 1`,
		);
	}
});
