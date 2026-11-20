import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * The series attribution tables and views in the built `atlas.sqlite`
 * (`pnpm data:build --only assemble-atlas`): every source, publisher and
 * licence a series depends on, and whether it is commercial-safe or ShareAlike.
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

test("every series reaches at least one source", () => {
	assert.deepEqual(
		all(`SELECT id, key FROM series
			 WHERE id NOT IN (SELECT series_id FROM series_source)`),
		[],
	);
	assert.equal(
		one("SELECT count(*) AS n FROM v_series_terms"),
		one("SELECT count(*) AS n FROM series"),
	);
});

test("every source of an input is also a source of the series derived from it", () => {
	assert.deepEqual(
		all(`SELECT i.series_id, i.input_series_id, s.source_id
			 FROM series_input i JOIN series_source s ON s.series_id = i.input_series_id
			 WHERE NOT EXISTS (
			   SELECT 1 FROM series_source d
			   WHERE d.series_id = i.series_id AND d.source_id = s.source_id)
			 LIMIT 10`),
		[],
	);
});

test("every licence has an attribution statement", () => {
	assert.deepEqual(
		all(
			"SELECT id FROM licence WHERE attribution IS NULL OR trim(attribution) = ''",
		),
		[],
	);
});

test("no model input is left unresolved", () => {
	// A model input is a series key, `dataset:<slug>` or `weights:<basis>`.
	assert.deepEqual(
		all(`SELECT m.model_id, m.key FROM model_input m
			 WHERE m.key NOT IN (SELECT key FROM series)
			   AND m.key NOT LIKE 'dataset:%' AND m.key NOT LIKE 'weights:%'
			 LIMIT 10`),
		[],
	);
});

test("a series with an unknown licence is never reported commercial-safe", () => {
	assert.equal(
		one(
			"SELECT count(*) AS n FROM v_series_terms WHERE commercial_use IS NULL OR share_alike IS NULL",
		),
		0,
		"every licence reached by a series states its terms",
	);
	assert.deepEqual(
		all(`SELECT series_id FROM v_series_terms
			 WHERE commercial_use = 1 AND series_id IN (
			   SELECT sl.series_id FROM series_source_licence sl
			   JOIN licence l ON l.id = sl.licence_id WHERE l.commercial_use <> 1)`),
		[],
	);
});

test("a converted series built from ShareAlike inputs is ShareAlike", () => {
	const rows = all(`SELECT t.series_id FROM v_series_terms t
		JOIN series s ON s.id = t.series_id
		WHERE s.method = 'converted' AND t.share_alike = 1`);
	assert.ok(rows.length > 0, "some converted series are ShareAlike");
	for (const { series_id } of rows)
		assert.ok(
			one(`SELECT count(*) AS n FROM series_source_licence sl
				 JOIN licence l ON l.id = sl.licence_id
				 WHERE sl.series_id = ${series_id} AND l.share_alike = 1`) > 0,
			`series ${series_id} is ShareAlike through a licence it reaches`,
		);
	// ShareAlike through an input, not through its own dataset.
	assert.deepEqual(
		all(`SELECT s.id FROM series s
			 JOIN v_series_terms t ON t.series_id = s.id
			 JOIN series_input i ON i.series_id = s.id
			 JOIN v_series_terms ti ON ti.series_id = i.input_series_id
			 WHERE ti.share_alike = 1 AND t.share_alike <> 1 LIMIT 10`),
		[],
	);
});

test("the open notional model is not ShareAlike and the ShareAlike one is", () => {
	const terms =
		all(`SELECT series, share_alike, commercial_use, licences, attribution
		FROM v_series_terms
		WHERE series LIKE 'general-election/party-votes/constituency:2019-12-uk-bgc/party=lab~notional-%'
		ORDER BY series`);
	assert.equal(terms.length, 2);
	const [open, sharealike] = terms as [
		Record<string, unknown>,
		Record<string, unknown>,
	];
	assert.match(String(open.series), /notional-open/);
	assert.equal(open.share_alike, 0);
	assert.equal(open.commercial_use, 1);
	assert.doesNotMatch(String(open.licences), /cc-by-sa/);
	assert.match(String(sharealike.series), /notional-sharealike/);
	assert.equal(sharealike.share_alike, 1);
	assert.equal(sharealike.commercial_use, 1);
	assert.match(String(sharealike.licences), /cc-by-sa-3\.0/);
	assert.match(String(sharealike.attribution), /ShareAlike/);
});

test("the attribution text names a publisher and a licence statement", () => {
	assert.deepEqual(
		all(`SELECT series_id FROM v_series_terms
			 WHERE attribution NOT LIKE 'Source: %' OR attribution LIKE '%unknown%'
			 LIMIT 10`),
		[],
	);
	assert.equal(
		one(`SELECT count(*) AS n FROM v_series_terms t
			 WHERE t.series_id IN (SELECT series_id FROM series_source_licence)
			   AND t.attribution NOT LIKE '%.%.%'`),
		0,
	);
});

test("v_series_attribution has one row per series and source, with the closest via", () => {
	assert.equal(
		one(
			"SELECT count(*) AS n FROM (SELECT series_id, source_id FROM v_series_attribution GROUP BY 1, 2 HAVING count(*) > 1)",
		),
		0,
	);
	assert.deepEqual(
		all(
			"SELECT series_id FROM series_source WHERE depth = 0 AND via <> 'dataset' LIMIT 5",
		),
		[],
	);
});

test("a converted ward series reaches its dataset and its crosswalk sources", () => {
	const rows = all(`SELECT via, depth FROM v_series_attribution
		WHERE series LIKE 'population/population/ward:%~converted:%'
		GROUP BY series_id, source_id LIMIT 200`);
	assert.ok(rows.some((r) => r.via === "dataset"));
	assert.ok(rows.some((r) => r.via === "crosswalk"));
});
