import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { checkDatabase } from "../../src/storage/checkDatabase.ts";

test("checks a valid database with either integrity mode", () => {
	const db = new DatabaseSync(":memory:");
	try {
		db.exec(
			"CREATE TABLE parent (id INTEGER PRIMARY KEY); CREATE TABLE child (parent_id INTEGER REFERENCES parent(id)); INSERT INTO parent VALUES (1); INSERT INTO child VALUES (1)",
		);
		checkDatabase(db);
		checkDatabase(db, "quick_check");
	} finally {
		db.close();
	}
});

test("reports broken references with bounded examples", () => {
	const db = new DatabaseSync(":memory:");
	try {
		db.exec(
			"PRAGMA foreign_keys = OFF; CREATE TABLE parent (id INTEGER PRIMARY KEY); CREATE TABLE child (parent_id INTEGER REFERENCES parent(id)); INSERT INTO child VALUES (1), (2), (3), (4), (5), (6)",
		);
		assert.throws(
			() => checkDatabase(db),
			/child -> parent: 6 broken row\(s\), example rowids: 1, 2, 3, 4, 5/,
		);
	} finally {
		db.close();
	}
});

test("reports failing integrity results", () => {
	const db = new DatabaseSync(":memory:");
	try {
		const prepare = db.prepare.bind(db);
		db.prepare = ((sql: string) =>
			sql === "PRAGMA integrity_check"
				? { all: () => [{ integrity_check: "damaged page" }] }
				: prepare(sql)) as typeof db.prepare;
		assert.throws(
			() => checkDatabase(db),
			/integrity_check failed: damaged page/,
		);
	} finally {
		db.close();
	}
});
