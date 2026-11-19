import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import type { IdRegistries } from "../../src/ids/idRegistries.ts";
import { copyNotionalSeries } from "../../src/notional/copyNotional.ts";
import {
	copyNotionalMetrics,
	metricKey,
	seatMetrics,
	shareChangeKey,
} from "../../src/notional/notionalMetrics.ts";
import { NOTIONAL_COMPONENT_SCHEMA } from "../../src/notional/store.ts";

const FACTORS = { validVotes: 0.2, majority: 0.1, shareChange: 0.05 };

test("a seat's valid votes, majority and share changes, with Reform after the Brexit Party", () => {
	const metrics = seatMetrics(
		new Map([
			["con", { value: 600, atRisk: 300 }],
			["lab", { value: 300, atRisk: 150 }],
			["brx", { value: 100, atRisk: 50 }],
		]),
		new Map([
			["con", 400],
			["lab", 400],
			["ruk", 150],
			["green", 50],
		]),
		1000,
		FACTORS,
	);
	assert.deepEqual(metrics.validVotes, {
		value: 1000,
		lower: 900,
		upper: 1100,
	});
	assert.deepEqual(metrics.majority, { value: 300, lower: 250, upper: 350 });
	// The spread is 0.05 of the at-risk share, 50 points.
	assert.deepEqual(Object.fromEntries(metrics.shareChange), {
		con: { value: -20, lower: -22.5, upper: -17.5 },
		lab: { value: 10, lower: 7.5, upper: 12.5 },
		ruk: { value: 5, lower: 2.5, upper: 7.5 },
		green: { value: 5, lower: 5, upper: 5 },
	});
});

test("the bounds of a count stop at zero", () => {
	const metrics = seatMetrics(
		new Map([
			["con", { value: 510, atRisk: 1000 }],
			["lab", { value: 490, atRisk: 1000 }],
		]),
		new Map([["con", 1]]),
		1,
		FACTORS,
	);
	assert.equal(metrics.majority.lower, 0);
	assert.equal(metrics.validVotes.lower, 600);
});

/** The tables of `atlas.sqlite` the copy touches. */
const ATLAS = `
CREATE TABLE series (
	id INTEGER PRIMARY KEY, dataset_id INTEGER NOT NULL, measure_id INTEGER NOT NULL,
	release_id INTEGER NOT NULL,
	method TEXT NOT NULL CHECK (method IN ('published','converted','aggregated','modelled')),
	derived_from_id INTEGER REFERENCES series(id), key TEXT NOT NULL UNIQUE,
	CHECK ((method = 'published') = (derived_from_id IS NULL)));
CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, code TEXT NOT NULL);
CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT NOT NULL);
CREATE TABLE observation (
	series_id INTEGER NOT NULL, area_version_id INTEGER NOT NULL, period_id INTEGER NOT NULL,
	value REAL, status_id INTEGER NOT NULL, lower REAL, upper REAL, category_id INTEGER);
CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT NOT NULL);
CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER NOT NULL, release_id INTEGER NOT NULL);
CREATE TABLE area_releases (id INTEGER PRIMARY KEY, geography TEXT NOT NULL, release TEXT NOT NULL);
CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
INSERT INTO area_releases VALUES (6, 'constituency', '2019-12-uk-bgc'), (2, 'constituency', '2024-07-uk-bgc');
INSERT INTO area VALUES (1, 'E14001000'), (2, 'E14001001');
INSERT INTO area_version VALUES (10, 1, 2), (11, 2, 2);
INSERT INTO period VALUES (26, '2019-12-12'), (27, '2024-07-04');
INSERT INTO measure VALUES (8, 'valid-votes'), (31, 'party-votes'), (32, 'majority'), (40, 'party-vote-share-change');
INSERT INTO dimension_member VALUES (44, 'con'), (45, 'ruk');
INSERT INTO series VALUES
	(187, 18, 31, 6, 'published', NULL, 'general-election/party-votes/constituency:2019-12-uk-bgc/party=con'),
	(188, 18, 8, 6, 'published', NULL, 'general-election/valid-votes/constituency:2019-12-uk-bgc'),
	(189, 18, 32, 6, 'published', NULL, 'general-election/majority/constituency:2019-12-uk-bgc'),
	(287, 18, 31, 2, 'published', NULL, 'general-election/party-votes/constituency:2024-07-uk-bgc/party=con'),
	(288, 18, 31, 2, 'published', NULL, 'general-election/party-votes/constituency:2024-07-uk-bgc/party=ruk'),
	(289, 18, 8, 2, 'published', NULL, 'general-election/valid-votes/constituency:2024-07-uk-bgc');
INSERT INTO series_member VALUES (187, 3, 44), (287, 3, 44), (288, 3, 45);
INSERT INTO observation VALUES
	(287, 10, 27, 60, 1, NULL, NULL, NULL), (288, 10, 27, 40, 1, NULL, NULL, NULL), (289, 10, 27, 100, 1, NULL, NULL, NULL),
	(287, 11, 27, 30, 1, NULL, NULL, NULL), (288, 11, 27, 70, 1, NULL, NULL, NULL), (289, 11, 27, 100, 1, NULL, NULL, NULL);
`;

const COMPONENT = `
INSERT INTO notional_model VALUES ('modelled', 'notional-sharealike', 'With share-alike', 'cc-by-sa-3.0', 0.32);
INSERT INTO notional_estimate VALUES
	('modelled', 'E14001000', NULL, 'con', '2019-12-12', 100, 100, 100, 'derived', 0, 'E14000001'),
	('modelled', 'E14001001', NULL, 'con', '2019-12-12', 50, 40, 60, 'estimated', 50, 'E14000001,E14000002');
`;

const atlas = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(ATLAS);
	database.exec("ATTACH DATABASE ':memory:' AS notional_component");
	database.exec(
		NOTIONAL_COMPONENT_SCHEMA.replaceAll(
			"CREATE TABLE ",
			"CREATE TABLE notional_component.",
		),
	);
	database.exec(COMPONENT);
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

test("each model's metrics derive from the series they are made from", () => {
	const database = atlas();
	const ids = registries();
	copyNotionalSeries(database, ids);
	assert.deepEqual(copyNotionalMetrics(database, ids), {
		series: 4,
		observations: 8,
	});
	assert.deepEqual(
		rows(
			database,
			`SELECT s.key, s.measure_id, s.derived_from_id, sm.member_id, m.model_id
			FROM series s JOIN series_model m ON m.series_id = s.id
			LEFT JOIN series_member sm ON sm.series_id = s.id
			WHERE s.measure_id <> 31 ORDER BY s.key`,
		),
		[
			{
				key: metricKey("majority", "notional-sharealike"),
				measure_id: 32,
				derived_from_id: 189,
				member_id: null,
				model_id: "notional-sharealike",
			},
			{
				key: shareChangeKey("con", "notional-sharealike"),
				measure_id: 40,
				derived_from_id: 900,
				member_id: 44,
				model_id: "notional-sharealike",
			},
			// Reform had no notional series, so its change derives from 2024's.
			{
				key: shareChangeKey("ruk", "notional-sharealike"),
				measure_id: 40,
				derived_from_id: 288,
				member_id: 45,
				model_id: "notional-sharealike",
			},
			{
				key: metricKey("valid-votes", "notional-sharealike"),
				measure_id: 8,
				derived_from_id: 188,
				member_id: null,
				model_id: "notional-sharealike",
			},
		],
	);
	assert.equal(
		shareChangeKey("con", "notional-sharealike"),
		"general-election/party-vote-share-change/constituency:2024-07-uk-bgc/party=con~notional-sharealike:constituency:2024-07-uk-bgc",
	);
});

test("a whole-seat metric is derived and exact, a split one estimated with bounds", () => {
	const database = atlas();
	const ids = registries();
	copyNotionalSeries(database, ids);
	copyNotionalMetrics(database, ids);
	assert.deepEqual(
		rows(
			database,
			`SELECT o.area_version_id, o.period_id, o.value, o.status_id, o.lower, o.upper
			FROM observation o WHERE o.series_id = (SELECT id FROM series WHERE key = '${shareChangeKey("con", "notional-sharealike")}')
			ORDER BY o.area_version_id`,
		),
		[
			{
				area_version_id: 10,
				period_id: 27,
				value: -40,
				status_id: 6,
				lower: null,
				upper: null,
			},
			{
				area_version_id: 11,
				period_id: 27,
				value: -70,
				status_id: 2,
				lower: -73.1,
				upper: -66.9,
			},
		],
	);
});
