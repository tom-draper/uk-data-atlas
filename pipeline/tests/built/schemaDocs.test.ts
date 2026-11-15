import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * `atlas.sqlite` describes itself (`pnpm data:build --only assemble-atlas`):
 * every table and view has a row in `schema_table`, and every worked example
 * runs and returns rows.
 */
const ATLAS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build/atlas.sqlite",
);
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

const all = (sql: string) => database.prepare(sql).all();

test("every worked example returns rows", () => {
	const examples = all(
		"SELECT id, sql FROM schema_example ORDER BY position",
	) as Array<{ id: string; sql: string }>;
	assert.ok(examples.length > 0);
	for (const { id, sql } of examples)
		assert.ok(all(sql).length > 0, `example ${id} returned no rows`);
});

test("schema_table covers every table and view", () => {
	const missing = all(
		`SELECT l.name FROM pragma_table_list l
		 WHERE l.schema = 'main' AND l.name NOT LIKE 'sqlite_%' AND l.type IN ('table', 'view', 'virtual')
		   AND l.name NOT IN (SELECT name FROM schema_table)`,
	);
	assert.deepEqual(missing, []);
	const unknown = all(
		`SELECT name FROM schema_table
		 WHERE name NOT IN (SELECT name FROM pragma_table_list WHERE schema = 'main')`,
	);
	assert.deepEqual(unknown, []);
	assert.deepEqual(
		all(
			"SELECT name FROM schema_table WHERE trim(description) = '' OR audience NOT IN ('core', 'reference', 'internal')",
		),
		[],
	);
});

test("schema_column covers every column of a core or reference table", () => {
	const missing = all(
		`SELECT t.name AS table_name, c.name AS column_name
		 FROM schema_table t JOIN pragma_table_info(t.name) c
		 WHERE t.audience <> 'internal'
		   AND NOT EXISTS (SELECT 1 FROM schema_column d WHERE d.table_name = t.name AND d.column_name = c.name)`,
	);
	assert.deepEqual(missing, []);
});

test("the guide and the search table answer", () => {
	assert.ok(
		all("SELECT body FROM schema_guide ORDER BY position").length > 0,
	);
	for (const kind of [
		"measure",
		"dataset",
		"dimension_member",
		"area",
		"place",
	])
		assert.ok(
			all(`SELECT 1 FROM search WHERE kind = '${kind}' LIMIT 1`).length >
				0,
			`search holds no ${kind}`,
		);
	assert.ok(
		all(
			"SELECT key FROM search WHERE search MATCH 'manchester' AND kind = 'area'",
		).length > 0,
	);
});

test("v_area_current is each area once, at its latest release", () => {
	assert.deepEqual(
		all(
			"SELECT (SELECT count(*) FROM area) AS areas, (SELECT count(*) FROM v_area_current) AS current_rows, (SELECT count(DISTINCT area_id) FROM v_area_current) AS distinct_areas",
		).map((row) => [row.areas, row.current_rows, row.distinct_areas]),
		all("SELECT count(*) AS n FROM area").map((row) => [
			row.n,
			row.n,
			row.n,
		]),
	);
	// The name the search table used before it read the view.
	assert.deepEqual(
		all(
			`SELECT a.code FROM area a JOIN v_area_current c ON c.area_id = a.id
			 WHERE c.name IS NOT (SELECT v.name FROM area_version v JOIN area_releases r ON r.id = v.release_id
			                      WHERE v.area_id = a.id ORDER BY r.release DESC LIMIT 1)`,
		),
		[],
	);
});

test("every area and place is searchable, and v_series lists every series", () => {
	assert.deepEqual(
		all(
			"SELECT (SELECT count(*) FROM search WHERE kind = 'area') AS areas, (SELECT count(*) FROM search WHERE kind = 'place') AS places",
		),
		all(
			"SELECT (SELECT count(*) FROM area) AS areas, (SELECT count(*) FROM named_location) AS places",
		),
	);
	assert.deepEqual(
		all("SELECT count(*) AS n FROM v_series"),
		all("SELECT count(*) AS n FROM series"),
	);
});
