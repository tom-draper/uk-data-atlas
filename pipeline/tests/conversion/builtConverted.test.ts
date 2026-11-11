import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

/**
 * The converted series in the built atlas, checked against the contract the
 * documentation gives them. Skipped where no atlas has been built, and where
 * the one built predates the standard releases.
 */

const path = fileURLToPath(
	new URL("../../../data/build/atlas.sqlite", import.meta.url),
);

const open = () => {
	if (!existsSync(path)) return undefined;
	const database = new DatabaseSync(path, { readOnly: true });
	const columns = database
		.prepare("SELECT name FROM pragma_table_info('conversion_skip')")
		.all();
	if (columns.length === 0) {
		database.close();
		return undefined;
	}
	return database;
};

const count = (database: DatabaseSync, sql: string) =>
	(database.prepare(sql).get() as { n: number }).n;

test("every converted series names its rule, crosswalks, basis and scores", (context) => {
	const database = open();
	if (!database) return context.skip();
	context.onTestFinished(() => database.close());

	assert.ok(
		count(
			database,
			"SELECT count(*) n FROM series WHERE method = 'converted'",
		) > 0,
	);
	assert.equal(
		count(
			database,
			`SELECT count(*) n FROM series s
			WHERE s.method = 'converted'
				AND NOT EXISTS (SELECT 1 FROM series_conversion c WHERE c.series_id = s.id)`,
		),
		0,
		"a converted series has no series_conversion row",
	);
	assert.equal(
		count(
			database,
			`SELECT count(*) n FROM series_conversion
			WHERE exact_share NOT BETWEEN 0 AND 1 OR coverage NOT BETWEEN 0 AND 1
				OR basis_id NOT IN (SELECT id FROM weight_basis)`,
		),
		0,
	);
	assert.equal(
		count(
			database,
			`SELECT count(*) n FROM series s
			WHERE s.method = 'converted'
				AND NOT EXISTS (SELECT 1 FROM series_crosswalk x WHERE x.series_id = s.id)
				AND NOT EXISTS (SELECT 1 FROM series_input i WHERE i.series_id = s.id)`,
		),
		0,
		"a converted series names no crosswalk and no input",
	);
});

test("converted values are derived or estimated and published series are untouched", (context) => {
	const database = open();
	if (!database) return context.skip();
	context.onTestFinished(() => database.close());

	assert.equal(
		count(
			database,
			`SELECT count(*) n FROM observation o
			JOIN series s ON s.id = o.series_id
			WHERE s.method = 'converted' AND o.status_id NOT IN (2, 6)`,
		),
		0,
		"a converted value claims to be observed",
	);
	assert.equal(
		count(
			database,
			`SELECT count(*) n FROM series_conversion c
			JOIN series s ON s.id = c.series_id
			WHERE s.method <> 'converted'`,
		),
		0,
		"a published series has a conversion row",
	);
});

test("a series that is wholly exact is scored 1 and one with a split is not", (context) => {
	const database = open();
	if (!database) return context.skip();
	context.onTestFinished(() => database.close());

	assert.equal(
		count(
			database,
			"SELECT count(*) n FROM series_conversion WHERE exact = 1 AND exact_share < 1",
		),
		0,
		"a series marked exact carries an estimated share",
	);
});

test("the skips name an allowed reason, and no series is both converted and skipped", (context) => {
	const database = open();
	if (!database) return context.skip();
	context.onTestFinished(() => database.close());

	assert.equal(
		count(
			database,
			`SELECT count(*) n FROM conversion_skip
			WHERE reason NOT IN ('refused-measure','no-route','published-on-target','missing-component','no-values')
				OR series < 1`,
		),
		0,
	);
	assert.equal(
		count(
			database,
			`SELECT count(*) n FROM conversion_skip k
			WHERE k.reason = 'published-on-target'
				AND NOT EXISTS (
					SELECT 1 FROM series s
					WHERE s.method = 'published' AND s.dataset_id = k.dataset_id
						AND s.measure_id = k.measure_id AND s.release_id = k.target_release_id)`,
		),
		0,
		"a series is skipped as published on a release it is not published on",
	);
});

test("a summed series that scores full coverage keeps the total of its source", (context) => {
	const database = open();
	if (!database) return context.skip();
	context.onTestFinished(() => database.close());

	const rows = database
		.prepare(
			`SELECT s.id, s.key,
				(SELECT sum(value) FROM observation WHERE series_id = s.id) AS converted,
				(SELECT sum(value) FROM observation WHERE series_id = s.derived_from_id) AS source
			FROM series s JOIN series_conversion c ON c.series_id = s.id
			WHERE s.method = 'converted' AND c.rule = 'sum' AND c.coverage = 1`,
		)
		.all() as { key: string; converted: number; source: number }[];
	assert.ok(rows.length > 0);
	const lost = rows.filter(
		(row) =>
			Math.abs(row.converted - row.source) >
			1e-6 * Math.max(1, Math.abs(row.source)),
	);
	assert.deepEqual(
		lost.map((row) => row.key),
		[],
		"a series scores full coverage yet drops some of its source's total",
	);
});

/** The value of a series in the area with a code, or undefined. */
const valueAt = (database: DatabaseSync, key: string, code: string) =>
	(
		database
			.prepare(
				`SELECT o.value AS value FROM observation o
				JOIN series s ON s.id = o.series_id
				JOIN area_version av ON av.id = o.area_version_id
				JOIN area a ON a.id = av.area_id
				WHERE s.key = ? AND a.code = ?`,
			)
			.get(key, code) as { value: number } | undefined
	)?.value;

const CONVERTED_TO_LA = "~converted:localAuthority:2026-05-uk-bgc";

test("fuel poverty across the Cumbria merge is the sum of its parts over the sum of its households", (context) => {
	const database = open();
	if (!database) return context.skip();
	context.onTestFinished(() => database.close());

	const stem = "fuel-poverty/%s/lsoa:2021-12-ew-bgc-v5" + CONVERTED_TO_LA;
	const at = (measure: string, code: string) =>
		valueAt(database, stem.replace("%s", measure), code);
	const poor = at("fuel-poor-households", "E06000063");
	const households = at("households", "E06000063");
	const rate = at("fuel-poverty-rate", "E06000063");
	if (poor === undefined || households === undefined || rate === undefined)
		return context.skip();

	// Rebuilt from the converted numerator and denominator, a percentage.
	assert.ok(Math.abs(rate - (100 * poor) / households) < 1e-9);

	// Allerdale, Carlisle and Copeland sum to Cumberland, and the rate is not
	// the mean of the published small-area rates.
	const published = (measure: string) => {
		const id = (
			database
				.prepare("SELECT id FROM series WHERE key = ?")
				.get(`fuel-poverty/${measure}/lsoa:2021-12-ew-bgc-v5`) as {
				id: number;
			}
		).id;
		return database
			.prepare(
				`SELECT o.value AS value FROM observation o
				JOIN area_version av ON av.id = o.area_version_id
				WHERE o.series_id = ?
					AND (av.name LIKE 'Allerdale %' OR av.name LIKE 'Carlisle %' OR av.name LIKE 'Copeland %')`,
			)
			.all(id)
			.map((row) => (row as { value: number }).value);
	};
	const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
	const rates = published("fuel-poverty-rate");
	assert.equal(poor, sum(published("fuel-poor-households")));
	assert.equal(households, sum(published("households")));
	assert.ok(Math.abs(rate - sum(rates) / rates.length) > 1e-3);
});
