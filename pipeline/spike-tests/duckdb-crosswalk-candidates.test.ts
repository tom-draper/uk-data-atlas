import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DuckDBInstance } from "@duckdb/node-api";
import type { Bounds } from "@uk-data-atlas/geography/area-geometry-pieces";
import { duckdbCrosswalkCandidates } from "../src/duckdbCrosswalkCandidates";

test("spatial candidates include touching bounds in source and target order", async () => {
	const temp = mkdtempSync(join(tmpdir(), "atlas-duckdb-test-"));
	const db = await DuckDBInstance.create(":memory:");
	const connection = await db.connect();
	try {
		await connection.run("SET memory_limit='2GB'");
		await connection.run(
			`SET temp_directory='${temp.replaceAll("'", "''")}'`,
		);
		await connection.run("LOAD spatial");
		const box = (bounds: Bounds) => ({ bounds });
		const sources = new Map([
			["second", box([10, 10, 11, 11])],
			["first", box([0, 0, 1, 1])],
			["empty", box([50, 50, 51, 51])],
		]);
		const targets = new Map([
			["point", box([1, 1, 1, 1])],
			["second-target", box([10, 10, 12, 12])],
			["edge", box([1, 0, 2, 1])],
			["inside", box([0.1, 0.1, 0.5, 0.5])],
			["outside", box([2, 2, 3, 3])],
		]);
		assert.deepEqual(
			[
				...(await duckdbCrosswalkCandidates(
					connection,
					sources,
					targets,
				)),
			],
			[
				["second", ["second-target"]],
				["first", ["point", "edge", "inside"]],
			],
		);
	} finally {
		connection.closeSync();
		db.closeSync();
		rmSync(temp, { recursive: true, force: true });
	}
});
