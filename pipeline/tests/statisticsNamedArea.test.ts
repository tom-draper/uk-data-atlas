import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { createStatisticsAreaLookup } from "../src/storage/statisticsAreaLookup";

const database = () => {
	const db = new DatabaseSync(":memory:");
	db.exec(`
		CREATE TABLE area_releases (position INTEGER, geography TEXT, id TEXT, status TEXT);
		CREATE TABLE area (id INTEGER, code TEXT);
		CREATE TABLE area_version (id INTEGER, area_id INTEGER, release_id INTEGER, name TEXT);
		INSERT INTO area_releases VALUES (0, 'country', '2020-12-uk-bgc', 'available'),
			(1, 'country', '2024-12-uk-bgc', 'available'),
			(2, 'region', '2025-12-en-bgc', 'available'),
			(3, 'region', '2010-12-en-bgc', 'unavailable');
		INSERT INTO area VALUES (1, 'W92000004'), (2, 'S92000003'), (3, 'E12000001'), (4, 'E12000002');
		INSERT INTO area_version VALUES (1, 1, 0, 'Wales'), (2, 2, 0, 'Scotland'),
			(3, 1, 1, 'Wales'), (4, 2, 1, 'Scotland'),
			(5, 3, 2, 'North East'), (6, 4, 2, 'North East');
	`);
	return db;
};

test("finds a name in the release nearest the year, later on a tie", () => {
	const db = database();
	const { namedArea } = createStatisticsAreaLookup();
	assert.equal(namedArea(db, "country", 2010, "Wales"), 1);
	assert.equal(namedArea(db, "country", 2022, "Wales"), 3);
	assert.equal(namedArea(db, "country", 2024, "Scotland"), 4);
});

test("finds nothing for an unknown, inexact, shared or unreleased name", () => {
	const db = database();
	const { namedArea } = createStatisticsAreaLookup();
	assert.equal(namedArea(db, "country", 2024, "Wales "), undefined);
	assert.equal(namedArea(db, "country", 2024, "England"), undefined);
	assert.equal(namedArea(db, "region", 2024, "North East"), undefined);
	assert.equal(namedArea(db, "ward", 2024, "Wales"), undefined);
});
