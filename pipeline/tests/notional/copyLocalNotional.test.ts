import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import type { IdRegistries } from "../../src/ids/idRegistries.ts";
import { ATLAS_MODEL_SCHEMA } from "../../src/notional/copyNotional.ts";
import {
	copyLocalNotionalSeries,
	localNotionalKey,
} from "../../src/notional/local/copyLocalNotional.ts";
import { LOCAL_NOTIONAL_SCHEMA } from "../../src/notional/local/store.ts";

/** The tables of `atlas.sqlite` the copy touches. */
const ATLAS = `
CREATE TABLE series (
	id INTEGER PRIMARY KEY, dataset_id INTEGER NOT NULL, measure_id INTEGER NOT NULL,
	release_id INTEGER NOT NULL,
	method TEXT NOT NULL CHECK (method IN ('published','converted','aggregated','modelled')),
	derived_from_id INTEGER REFERENCES series(id), key TEXT NOT NULL UNIQUE,
	CHECK ((method = 'published') = (derived_from_id IS NULL)));
CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
CREATE TABLE observation (
	series_id INTEGER NOT NULL, area_version_id INTEGER NOT NULL, period_id INTEGER NOT NULL,
	value REAL, status_id INTEGER NOT NULL, lower REAL, upper REAL, category_id INTEGER);
CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT NOT NULL);
CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER NOT NULL, release_id INTEGER NOT NULL);
CREATE TABLE area_releases (id INTEGER PRIMARY KEY, geography TEXT NOT NULL, release TEXT NOT NULL);
CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
${ATLAS_MODEL_SCHEMA}
INSERT INTO area_releases VALUES (1, 'ward', '2018-12-uk-bgc'), (2, 'ward', '2022-05-uk-bgc');
INSERT INTO area VALUES (1, 'E05000001'), (2, 'E05000002');
INSERT INTO area_version VALUES (10, 1, 2), (11, 2, 2);
INSERT INTO period VALUES (5, '2019-05-02'), (6, '2021-05-06');
INSERT INTO series VALUES
	(70, 9, 31, 1, 'published', NULL, 'local-election/party-votes/ward:2018-12-uk-bgc/party=con');
INSERT INTO series_member VALUES (70, 3, 44);
`;

const COMPONENT = `
INSERT INTO local_notional_model VALUES
	('notional-local-sharealike', 'Share-alike', 'cc-by-sa-3.0', 0.23),
	('notional-local-open', 'Open', NULL, 0.23);
INSERT INTO local_notional_input VALUES
	('notional-local-sharealike', 'local election 2019-05-02', 'local-election/a'),
	('notional-local-open', 'local election 2021-05-06', 'local-election/b');
INSERT INTO local_notional_estimate VALUES
	('notional-local-sharealike', 'E05000001', NULL, '2022-05-uk-bgc', '2018-12-uk-bgc', '2019-05-02', 'con', 100, 100, 100, 'derived', 0, 1, 'E05999999'),
	('notional-local-open', 'E05000002', NULL, '2022-05-uk-bgc', '2018-12-uk-bgc', '2021-05-06', 'con', 50, 40, 60, 'estimated', 43, 1, 'E05999998,E05999999');
`;

const atlas = (component = COMPONENT) => {
	const database = new DatabaseSync(":memory:");
	database.exec(ATLAS);
	database.exec("ATTACH DATABASE ':memory:' AS notional_component");
	database.exec(
		LOCAL_NOTIONAL_SCHEMA.replaceAll(
			"CREATE TABLE ",
			"CREATE TABLE notional_component.",
		),
	);
	database.exec(component);
	return database;
};

const registries = () => {
	let next = 900;
	return {
		series: { assign: () => next++ },
	} as unknown as IdRegistries;
};

const rows = (database: DatabaseSync, sql: string) =>
	database
		.prepare(sql)
		.all()
		.map((row) => ({ ...row }));

test("each local model has modelled series from the old wards' published ones", () => {
	const database = atlas();
	assert.deepEqual(copyLocalNotionalSeries(database, registries()), {
		series: 2,
		observations: 2,
	});
	assert.deepEqual(
		rows(database, "SELECT id, licence_id FROM model ORDER BY id"),
		[
			{ id: "notional-local-open", licence_id: null },
			{ id: "notional-local-sharealike", licence_id: "cc-by-sa-3.0" },
		],
	);
	assert.deepEqual(
		rows(
			database,
			"SELECT s.key, s.release_id, s.derived_from_id, m.model_id FROM series s JOIN series_model m ON m.series_id = s.id ORDER BY s.key",
		),
		[
			{
				key: localNotionalKey(
					"2018-12-uk-bgc",
					"con",
					"notional-local-open",
					"2022-05-uk-bgc",
				),
				release_id: 2,
				derived_from_id: 70,
				model_id: "notional-local-open",
			},
			{
				key: "local-election/party-votes/ward:2018-12-uk-bgc/party=con~notional-local-sharealike:ward:2022-05-uk-bgc",
				release_id: 2,
				derived_from_id: 70,
				model_id: "notional-local-sharealike",
			},
		],
	);
	assert.deepEqual(
		rows(
			database,
			"SELECT area_version_id, period_id, value, status_id, lower, upper FROM observation ORDER BY area_version_id",
		),
		[
			{
				area_version_id: 10,
				period_id: 5,
				value: 100,
				status_id: 6,
				lower: null,
				upper: null,
			},
			{
				area_version_id: 11,
				period_id: 6,
				value: 50,
				status_id: 2,
				lower: 40,
				upper: 60,
			},
		],
	);
	assert.equal(
		rows(database, "SELECT * FROM series_member WHERE series_id >= 900")
			.length,
		2,
	);
	assert.equal(rows(database, "SELECT * FROM model_input").length, 2);
});

test("a ward missing from its release fails the copy", () => {
	const database = atlas(
		COMPONENT.replace("'E05000002', NULL", "'E05000003', NULL"),
	);
	assert.throws(
		() => copyLocalNotionalSeries(database, registries()),
		/another set of wards \(E05000003 2022-05-uk-bgc\)/,
	);
});

test("an old ward release with no published series fails the copy", () => {
	const database = atlas(
		COMPONENT.replaceAll(
			"'2018-12-uk-bgc', '2021",
			"'2019-12-uk-bgc', '2021",
		),
	);
	assert.throws(
		() => copyLocalNotionalSeries(database, registries()),
		/no local-election\/party-votes\/ward:2019-12-uk-bgc\/party=con/,
	);
});
