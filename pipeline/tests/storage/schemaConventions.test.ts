import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { checkSchemaConventions } from "../../src/storage/schemaConventions.js";

const open = (...statements: string[]): DatabaseSync => {
	const database = new DatabaseSync(":memory:");
	for (const statement of statements) database.exec(statement);
	return database;
};

test("a clean schema has no findings", () => {
	const database = open(
		"CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT NOT NULL) STRICT",
		"CREATE TABLE area_release (id INTEGER PRIMARY KEY, status TEXT NOT NULL) STRICT",
		"CREATE VIEW area_name AS SELECT id, code FROM area",
	);
	assert.deepEqual(checkSchemaConventions(database), []);
});

test("each rule reports its own violation", () => {
	const database = open(
		"CREATE TABLE loose (id INTEGER)",
		"CREATE TABLE areas (id INTEGER) STRICT",
		"CREATE TABLE area_set (areaId INTEGER) STRICT",
		"CREATE TABLE crosswalk (id INTEGER, artifact TEXT, content_hash TEXT) STRICT",
		"CREATE TABLE payloads (id TEXT, payload TEXT) STRICT",
		"CREATE TABLE area_inventory_metadata (id INTEGER) STRICT",
		"CREATE TABLE dataset_build (id INTEGER) STRICT",
		"CREATE TABLE statistics_selector_value (id INTEGER) STRICT",
	);
	expect(checkSchemaConventions(database)).toEqual(
		expect.arrayContaining([
			{ rule: "strict", subject: "loose" },
			{ rule: "plural-table", subject: "areas" },
			{ rule: "camel-case", subject: "area_set.areaId" },
			{ rule: "build-metadata", subject: "crosswalk.artifact" },
			{ rule: "build-metadata", subject: "crosswalk.content_hash" },
			{ rule: "payload-table", subject: "payloads" },
			{ rule: "build-metadata", subject: "area_inventory_metadata" },
			{ rule: "build-metadata", subject: "dataset_build" },
			{ rule: "build-metadata", subject: "statistics_selector_value" },
		]),
	);
});

test("a camelCase table or view name is reported", () => {
	const database = open(
		"CREATE TABLE areaSet (id INTEGER) STRICT",
		"CREATE VIEW areaView AS SELECT id FROM areaSet",
	);
	assert.deepEqual(
		checkSchemaConventions(database).map((finding) => finding.subject),
		["areaSet", "areaView"],
	);
});

test("an allowlisted finding passes and a stale entry fails", () => {
	const database = open("CREATE TABLE areas (id INTEGER) STRICT");
	assert.deepEqual(
		checkSchemaConventions(database, { "plural-table": ["areas"] }),
		[],
	);
	assert.deepEqual(
		checkSchemaConventions(database, {
			"plural-table": ["areas", "gone"],
		}),
		[{ rule: "plural-table", subject: "gone (stale allowlist entry)" }],
	);
});

test("FTS5 tables are exempt from STRICT", () => {
	const database = open("CREATE VIRTUAL TABLE search USING fts5(body)");
	assert.deepEqual(checkSchemaConventions(database), []);
});

test("table.* allows every column of a table", () => {
	const database = open(
		"CREATE TABLE area_set (areaId INTEGER, otherId INTEGER) STRICT",
	);
	assert.deepEqual(
		checkSchemaConventions(database, { "camel-case": ["area_set.*"] }),
		[],
	);
});
