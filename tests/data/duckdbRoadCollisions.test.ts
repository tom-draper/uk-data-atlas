import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

test("DuckDB production fixtures", () => {
	const result = spawnSync(
		process.execPath,
		[
			"--import",
			"tsx",
			"--test",
			"experiments/duckdb-road-collisions/production-fixtures.test.mts",
		],
		{ encoding: "utf8" },
	);
	expect(result.status, result.stderr || result.stdout).toBe(0);
	expect(result.stdout).toMatch(/pass 1/);
});
