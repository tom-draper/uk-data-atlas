import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import type { IdRegistries } from "../../src/ids/idRegistries.ts";
import {
	copyNotionalSeries,
	notionalKey,
} from "../../src/notional/copyNotional.ts";
import { NOTIONAL_COMPONENT_SCHEMA } from "../../src/notional/store.ts";

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
CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT NOT NULL, release TEXT NOT NULL);
CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
INSERT INTO area_release VALUES (6, 'constituency', '2019-12-uk-bgc'), (2, 'constituency', '2024-07-uk-bgc');
INSERT INTO area VALUES (1, 'E14001000'), (2, 'E14001001');
INSERT INTO area_version VALUES (10, 1, 2), (11, 2, 2), (12, 1, 6);
INSERT INTO period VALUES (26, '2019-12-12');
INSERT INTO series VALUES (187, 18, 31, 6, 'published', NULL, 'general-election/party-votes/constituency:2019-12-uk-bgc/party=con');
INSERT INTO series_member VALUES (187, 3, 44);
`;

const COMPONENT = `
INSERT INTO notional_model VALUES
	('modelled', 'notional-sharealike', 'With share-alike', 'cc-by-sa-3.0', 0.32),
	('open', 'notional-open', 'Without share-alike', NULL, 0.38);
INSERT INTO notional_input VALUES
	('modelled', 'local election 2019-05-02', 'local-election/a'),
	('open', 'general election', 'general-election/b'),
	('baseline', 'general election', 'general-election/b');
INSERT INTO notional_estimate VALUES
	('modelled', 'E14001000', NULL, 'con', '2019-12-12', 100, 100, 100, 'derived', 0, 'E14000001'),
	('modelled', 'E14001001', NULL, 'con', '2019-12-12', 50, 40, 60, 'estimated', 31, 'E14000001,E14000002'),
	('open', 'E14001000', NULL, 'con', '2019-12-12', 100, 100, 100, 'derived', 0, 'E14000001'),
	('open', 'E14001001', NULL, 'con', '2019-12-12', 55, 45, 65, 'estimated', 26, 'E14000001,E14000002'),
	('baseline', 'E14001001', NULL, 'con', '2019-12-12', 70, 60, 80, 'estimated', 26, 'E14000001');
`;

const atlas = (component = COMPONENT) => {
	const database = new DatabaseSync(":memory:");
	database.exec(ATLAS);
	database.exec("ATTACH DATABASE ':memory:' AS notional_component");
	database.exec(
		NOTIONAL_COMPONENT_SCHEMA.replaceAll(
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

test("each shipped method is a model of modelled series derived from the 2019 ones", () => {
	const database = atlas();
	assert.deepEqual(copyNotionalSeries(database, registries()), {
		series: 2,
		observations: 4,
	});
	assert.deepEqual(
		rows(
			database,
			"SELECT id, licence_id, bound_factor FROM model ORDER BY id",
		),
		[
			{ id: "notional-open", licence_id: null, bound_factor: 0.38 },
			{
				id: "notional-sharealike",
				licence_id: "cc-by-sa-3.0",
				bound_factor: 0.32,
			},
		],
	);
	assert.deepEqual(
		rows(
			database,
			"SELECT model_id, key FROM model_input ORDER BY model_id",
		),
		[
			{ model_id: "notional-open", key: "general-election/b" },
			{ model_id: "notional-sharealike", key: "local-election/a" },
		],
	);
	assert.deepEqual(
		rows(
			database,
			`SELECT s.key, s.release_id, s.derived_from_id, m.model_id, sm.member_id
			FROM series s JOIN series_model m ON m.series_id = s.id
			JOIN series_member sm ON sm.series_id = s.id ORDER BY s.key`,
		),
		[
			{
				key: notionalKey("con", "notional-open"),
				release_id: 2,
				derived_from_id: 187,
				model_id: "notional-open",
				member_id: 44,
			},
			{
				key: notionalKey("con", "notional-sharealike"),
				release_id: 2,
				derived_from_id: 187,
				model_id: "notional-sharealike",
				member_id: 44,
			},
		],
	);
	assert.equal(
		notionalKey("con", "notional-open"),
		"general-election/party-votes/constituency:2019-12-uk-bgc/party=con~notional-open:constituency:2024-07-uk-bgc",
	);
});

test("a seat of whole 2019 seats is derived with no bounds, any other estimated with them", () => {
	const database = atlas();
	copyNotionalSeries(database, registries());
	assert.deepEqual(
		rows(
			database,
			`SELECT o.area_version_id, o.period_id, o.value, o.status_id, o.lower, o.upper
			FROM observation o JOIN series_model m ON m.series_id = o.series_id
			WHERE m.model_id = 'notional-sharealike' ORDER BY o.area_version_id`,
		),
		[
			{
				area_version_id: 10,
				period_id: 26,
				value: 100,
				status_id: 6,
				lower: null,
				upper: null,
			},
			{
				area_version_id: 11,
				period_id: 26,
				value: 50,
				status_id: 2,
				lower: 40,
				upper: 60,
			},
		],
	);
});

test("an estimate made from another base fails the copy", () => {
	assert.throws(
		() =>
			copyNotionalSeries(
				atlas(`${COMPONENT}
				INSERT INTO notional_estimate VALUES ('open', 'E14001000', NULL, 'snp', '2019-12-12', 1, 1, 1, 'derived', 0, 'E14000001');`),
				registries(),
			),
		/no snp/,
	);
	assert.throws(
		() =>
			copyNotionalSeries(
				atlas(`${COMPONENT}
				INSERT INTO notional_estimate VALUES ('open', 'E14009999', NULL, 'con', '2019-12-12', 1, 1, 1, 'derived', 0, 'E14000001');`),
				registries(),
			),
		/2024 seats/,
	);
});
