import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

test("DuckDB energy consumption fixtures", () => {
	const result = spawnSync(
		process.execPath,
		[
			"node_modules/vitest/vitest.mjs",
			"run",
			"--project",
			"duckdb-fixtures",
			"tests/duckdb-fixtures/energy-consumption.test.mts",
		],
		{ encoding: "utf8" },
	);
	expect(result.status, result.stderr || result.stdout).toBe(0);
	expect(result.stdout).toMatch(/2 passed/);
}, 30_000);
