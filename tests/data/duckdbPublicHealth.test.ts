import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

test("DuckDB production fixtures", () => {
	const result = spawnSync(
		process.execPath,
		[
			"node_modules/vitest/vitest.mjs",
			"run",
			"--project",
			"duckdb-fixtures",
			"tests/duckdb-fixtures/public-health.test.mts",
		],
		{ encoding: "utf8" },
	);
	expect(result.status, result.stderr || result.stdout).toBe(0);
	expect(result.stdout).toMatch(/1 passed/);
});
