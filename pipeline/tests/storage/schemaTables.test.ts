import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import type { SchemaDocs } from "../../src/storage/schemaDocs";
import {
	resolveSchemaDocs,
	writeSchemaDocs,
} from "../../src/storage/schemaTables";

const own: SchemaDocs["tables"] = {
	schema_table: {
		audience: "core",
		description: "Tables.",
		columns: {
			name: "n",
			kind: "k",
			audience: "a",
			description: "d",
		},
	},
	schema_column: {
		audience: "core",
		description: "Columns.",
		columns: { table_name: "t", column_name: "c", description: "d" },
	},
	schema_guide: {
		audience: "core",
		description: "Guide.",
		columns: { topic: "t", position: "p", body: "b" },
	},
	schema_example: {
		audience: "core",
		description: "Examples.",
		columns: {
			id: "i",
			position: "p",
			question: "q",
			sql: "s",
			expect: "e",
		},
	},
};

const docs = (
	tables: SchemaDocs["tables"],
	withSchema = false,
): SchemaDocs => ({
	guide: [{ topic: "start-here", body: "Read this." }],
	tables: withSchema ? { ...own, ...tables } : tables,
	examples: [{ id: "one", question: "q", sql: "SELECT 1", expect: "1 row" }],
});

const fixture = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE area (id INTEGER, code TEXT);
		CREATE TABLE plumbing (x INTEGER);
		CREATE VIEW v_area AS SELECT id, code FROM area;
		CREATE TABLE wide (id INTEGER, ward_2024DistanceCm INTEGER, wardDistanceCm INTEGER)`);
	return database;
};

const complete = {
	area: {
		audience: "core",
		description: "Areas.",
		columns: { id: "Id.", code: "Code." },
	},
	plumbing: { audience: "internal", description: "Cache.", columns: {} },
	v_area: {
		audience: "reference",
		description: "Areas.",
		columns: { id: "Id.", code: "Code." },
	},
	wide: {
		audience: "core",
		description: "Wide.",
		columns: { id: "Id." },
		columnPatterns: [
			{
				pattern: "<geography>_<release>DistanceCm",
				suffix: "DistanceCm",
				description: "Distance.",
			},
		],
	},
} as const satisfies SchemaDocs["tables"];

test("complete docs resolve, with patterns expanded and views marked", () => {
	const database = fixture();
	database.exec("CREATE VIRTUAL TABLE find USING fts5(a)");
	const { problems } = resolveSchemaDocs(
		database,
		docs({
			...complete,
			find: {
				audience: "core",
				description: "Search.",
				columns: { a: "A." },
			},
		}),
	);
	assert.deepEqual(problems, []);
});

test("writes the four tables, including the pattern columns", () => {
	const database = fixture();
	writeSchemaDocs(database, docs(complete, true));
	assert.equal(
		database
			.prepare("SELECT kind FROM schema_table WHERE name = 'v_area'")
			.get()?.kind,
		"view",
	);
	assert.deepEqual(
		database
			.prepare(
				"SELECT column_name FROM schema_column WHERE table_name = 'wide' ORDER BY column_name",
			)
			.all()
			.map((row) => row.column_name),
		["id", "wardDistanceCm", "ward_2024DistanceCm"],
	);
	assert.equal(
		database.prepare("SELECT count(*) AS n FROM schema_example").get()?.n,
		1,
	);
});

test("fails on a missing description, a missing column and an unknown name", () => {
	const database = fixture();
	const { area: _area, ...rest } = complete;
	const missingTable = resolveSchemaDocs(database, docs(rest)).problems;
	assert.ok(missingTable.some((p) => p.includes("area has no description")));
	const missingColumn = resolveSchemaDocs(
		database,
		docs({
			...complete,
			area: {
				audience: "core",
				description: "Areas.",
				columns: { id: "Id." },
			},
		}),
	).problems;
	assert.ok(
		missingColumn.some((p) => p.includes("area.code has no description")),
	);
	const unknown = resolveSchemaDocs(
		database,
		docs({
			...complete,
			area: {
				audience: "core",
				description: "Areas.",
				columns: { id: "Id.", code: "Code.", gone: "Gone." },
			},
			ghost: { audience: "internal", description: "No.", columns: {} },
		}),
	).problems;
	assert.ok(unknown.some((p) => p.includes("area.gone does not exist")));
	assert.ok(unknown.some((p) => p.includes("ghost does not exist")));
	assert.throws(
		() => writeSchemaDocs(database, docs(rest, true)),
		/area has no description/,
	);
});

test("internal tables need only a description", () => {
	const { problems } = resolveSchemaDocs(fixture(), docs(complete));
	assert.deepEqual(problems, []);
});
