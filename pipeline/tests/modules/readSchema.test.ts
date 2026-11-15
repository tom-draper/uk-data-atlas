import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { readSchema } from "../../src/modules/moduleTables";

test("a full-text table is read without its shadow tables", () => {
	const database = new DatabaseSync(":memory:");
	database.exec(
		"CREATE TABLE area (id INTEGER); CREATE VIRTUAL TABLE search USING fts5(label)",
	);
	assert.deepEqual(
		readSchema(database).map((row) => row.name),
		["area", "search"],
	);
	// Creating the virtual table creates its shadow tables, so none may clash.
	const copy = new DatabaseSync(":memory:");
	for (const row of readSchema(database)) copy.exec(row.sql);
});
