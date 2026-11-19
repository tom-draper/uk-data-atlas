import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * The default observation view in the built `atlas.sqlite`
 * (`pnpm data:build --only assemble-atlas`): one value for each quantity, area
 * and period, built from `measure_dimension`, `quantity` and
 * `series_preference`.
 */
const ATLAS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build/atlas.sqlite",
);
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

const all = (sql: string) => database.prepare(sql).all();
const columns = (name: string) =>
	(
		all(`SELECT name FROM pragma_table_info('${name}')`) as Array<{
			name: string;
		}>
	).map(({ name: column }) => column);

test("every dimension a series holds has a role for its measure", () => {
	assert.deepEqual(
		all(`SELECT DISTINCT s.measure_id, sm.dimension_id
			 FROM series s
			 JOIN series_member sm ON sm.series_id = s.id
			 JOIN dimension_member dm ON dm.id = sm.member_id
			 WHERE NOT EXISTS (
			   SELECT 1 FROM measure_dimension md
			   WHERE md.measure_id = s.measure_id AND md.dimension_id = dm.dimension_id)`),
		[],
	);
});

test("a breakdown has a default member that belongs to its dimension, a qualifier has none", () => {
	assert.deepEqual(
		all(`SELECT md.measure_id, md.dimension_id FROM measure_dimension md
			 WHERE (md.role = 'qualifier' AND md.default_member_id IS NOT NULL)
			    OR (md.default_member_id IS NOT NULL AND NOT EXISTS (
			      SELECT 1 FROM dimension_member dm
			      WHERE dm.id = md.default_member_id AND dm.dimension_id = md.dimension_id))`),
		[],
	);
});

test("every measure that has series has a series in the default view", () => {
	assert.deepEqual(
		all(`SELECT m.slug FROM measure m
			 WHERE EXISTS (SELECT 1 FROM series s WHERE s.measure_id = m.id)
			   AND NOT EXISTS (
			     SELECT 1 FROM quantity q WHERE q.measure_id = m.id)`),
		[],
	);
});

test("series_preference ranks each quantity's series without ties", () => {
	assert.deepEqual(
		all(`SELECT sp.series_id FROM series_preference sp
			 WHERE NOT EXISTS (SELECT 1 FROM series s WHERE s.id = sp.series_id)
			    OR NOT EXISTS (SELECT 1 FROM quantity q WHERE q.id = sp.quantity_id)`),
		[],
	);
	assert.deepEqual(
		all(`SELECT quantity_id FROM series_preference
			 GROUP BY quantity_id HAVING min(rank) <> 1 OR max(rank) <> count(*)`),
		[],
	);
	// A series ranked in a quantity belongs to its measure and release.
	assert.deepEqual(
		all(`SELECT sp.series_id FROM series_preference sp
			 JOIN quantity q ON q.id = sp.quantity_id
			 JOIN series s ON s.id = sp.series_id
			 WHERE s.measure_id <> q.measure_id`),
		[],
	);
});

test("every series is in at most one quantity", () => {
	assert.deepEqual(
		all(`SELECT series_id FROM series_preference
			 GROUP BY series_id HAVING count(*) > 1`),
		[],
	);
});

test("only series at the default of every breakdown are ranked", () => {
	assert.deepEqual(
		all(`SELECT sp.series_id, md.dimension_id
			 FROM series_preference sp
			 JOIN series s ON s.id = sp.series_id
			 JOIN series_member sm ON sm.series_id = s.id
			 JOIN dimension_member dm ON dm.id = sm.member_id
			 JOIN measure_dimension md
			   ON md.measure_id = s.measure_id AND md.dimension_id = dm.dimension_id
			 WHERE md.role = 'breakdown' AND sm.member_id IS NOT md.default_member_id`),
		[],
	);
});

test("v_observation_default starts with the columns of v_observation", () => {
	const wide = columns("v_observation");
	const narrow = columns("v_observation_default");
	assert.deepEqual(narrow.slice(0, wide.length), wide);
	assert.deepEqual(narrow.slice(wide.length), [
		"series_id",
		"quantity",
		"alternatives",
	]);
});

test("v_observation_default has one row for each quantity, area and period", () => {
	assert.deepEqual(
		all(`SELECT quantity, area_code, period, count(*) AS n
			 FROM v_observation_default
			 GROUP BY quantity, area_code, period HAVING n > 1 LIMIT 5`),
		[],
	);
});

test("alternatives counts the other series that hold the same quantity, area and period", () => {
	// One quantity with a contested value: the best series answers and the
	// column says another could have.
	const contested = all(
		`SELECT quantity, area_code, period, series_id, alternatives
		 FROM v_observation_default WHERE alternatives > 0 LIMIT 20`,
	) as Array<{
		quantity: string;
		area_code: string;
		period: string;
		series_id: number;
		alternatives: number;
	}>;
	assert.ok(contested.length > 0);
	for (const row of contested) {
		const holders = database
			.prepare(
				`SELECT count(*) AS n FROM series_preference sp
				 JOIN quantity q ON q.id = sp.quantity_id
				 JOIN observation o ON o.series_id = sp.series_id
				 JOIN area_version av ON av.id = o.area_version_id
				 JOIN area a ON a.id = av.area_id
				 JOIN period p ON p.id = o.period_id
				 WHERE q.key = ? AND a.code = ? AND p.label = ?`,
			)
			.get(row.quantity, row.area_code, row.period) as { n: number };
		assert.equal(holders.n, row.alternatives + 1, JSON.stringify(row));
	}
});
