import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * What a converted series says about its own uncertainty in the built
 * `atlas.sqlite` (`pnpm data:build --only assemble-atlas`): a regrouped value
 * has no bounds because nothing was estimated, a split value has bounds from
 * the backtest, and a split with no measured error is a gap, not a value.
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

const DERIVED = "(SELECT id FROM status WHERE slug = 'derived')";
const ESTIMATED = "(SELECT id FROM status WHERE slug = 'estimated')";
const OBSERVED = "(SELECT id FROM status WHERE slug = 'observed')";

test("a converted value is derived or estimated, never observed", () => {
	assert.ok(one("SELECT count(*) AS n FROM series_conversion") > 0);
	assert.equal(
		one(`SELECT count(*) AS n FROM observation o
			 JOIN series_conversion c ON c.series_id = o.series_id
			 WHERE o.status_id NOT IN (${DERIVED}, ${ESTIMATED})
			    OR o.status_id = ${OBSERVED}`),
		0,
	);
});

test("a regrouped value has no bounds, and a split value has bounds that hold it", () => {
	assert.equal(
		one(`SELECT count(*) AS n FROM observation o
			 JOIN series_conversion c ON c.series_id = o.series_id
			 WHERE o.status_id = ${DERIVED}
			   AND (o.lower IS NOT NULL OR o.upper IS NOT NULL)`),
		0,
	);
	// At least the constituency population split onto authorities is kept.
	assert.ok(
		one(`SELECT count(*) AS n FROM observation o
			 JOIN series_conversion c ON c.series_id = o.series_id
			 WHERE o.status_id = ${ESTIMATED}`) > 0,
	);
	assert.deepEqual(
		all(`SELECT o.series_id, o.area_version_id, o.period_id
			 FROM observation o
			 JOIN series_conversion c ON c.series_id = o.series_id
			 WHERE o.status_id = ${ESTIMATED}
			   AND (o.lower IS NULL OR o.upper IS NULL
			        OR o.lower < 0 OR o.lower > o.value OR o.upper < o.value)
			 LIMIT 5`),
		[],
	);
});

test("each estimated value has one estimated share, and a regrouped value has none", () => {
	assert.equal(
		one(`SELECT count(*) AS n FROM observation o
			 JOIN series_conversion c ON c.series_id = o.series_id
			 WHERE o.status_id = ${ESTIMATED}
			   AND NOT EXISTS (
			     SELECT 1 FROM series_estimate e
			     WHERE e.series_id = o.series_id
			       AND e.area_version_id = o.area_version_id
			       AND e.period_id = o.period_id)`),
		0,
	);
	assert.equal(
		one(`SELECT count(*) AS n FROM series_estimate e
			 JOIN observation o ON o.series_id = e.series_id
			   AND o.area_version_id = e.area_version_id
			   AND o.period_id = e.period_id
			 WHERE o.status_id <> ${ESTIMATED}`),
		0,
	);
	assert.equal(
		one(`SELECT count(*) AS n FROM series_estimate e
			 WHERE NOT EXISTS (
			   SELECT 1 FROM observation o
			   WHERE o.series_id = e.series_id
			     AND o.area_version_id = e.area_version_id
			     AND o.period_id = e.period_id)`),
		0,
	);
});

test("a split with no measured error is a gap and holds no value", () => {
	assert.ok(
		one(
			"SELECT count(*) AS n FROM series_gap WHERE reason = 'unmeasured-split'",
		) > 0,
	);
	assert.equal(
		one(`SELECT count(*) AS n FROM series_gap g
			 JOIN observation o ON o.series_id = g.series_id
			   AND o.area_version_id = g.area_version_id
			   AND o.period_id = g.period_id`),
		0,
	);
});

test("the ward population by age split onto constituencies is estimated, with bounds", () => {
	const ages = `FROM observation o
		JOIN series s ON s.id = o.series_id
		WHERE s.key LIKE 'population/population/ward:2023-12-uk-bgc/age=%~converted:constituency:2024-07-uk-bgc'`;
	assert.ok(
		one(`SELECT count(*) AS n ${ages} AND o.status_id = ${ESTIMATED}`) > 0,
	);
	assert.equal(
		one(`SELECT count(*) AS n ${ages} AND o.status_id = ${ESTIMATED}
			   AND (o.lower IS NULL OR o.upper IS NULL)`),
		0,
	);
	// No age series is left a gap for want of a measured factor.
	assert.equal(
		one(`SELECT count(*) AS n FROM series_gap g
			 JOIN series s ON s.id = g.series_id
			 WHERE g.reason = 'unmeasured-split'
			   AND s.key LIKE 'population/population/ward:2023-12-uk-bgc/age=%~converted:constituency:2024-07-uk-bgc'`),
		0,
	);
});
