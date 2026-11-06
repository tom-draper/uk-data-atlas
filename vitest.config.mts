import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

/** Tests that read generated data or the raw source data in data/. */
const BUILT_TESTS = "tests/built/**/*.test.ts";

const FIXTURE_DATASETS = fileURLToPath(
	new URL("tests/fixtures/datasets", import.meta.url),
);

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		globals: true,
		environment: "node",
		// Tests replace and delete database files and read straight after.
		env: { ATLAS_SQLITE_RECHECK_MS: "0" },
		projects: [
			...[
				{ name: "pipeline", include: ["pipeline/tests/*.test.ts"] },
				{
					name: "pipeline-built",
					include: ["pipeline/tests/built/*.test.ts"],
				},
				{ name: "api", include: ["services/api/tests/*.test.ts"] },
				{
					name: "api-built",
					include: ["services/api/tests/built/*.test.ts"],
				},
				{ name: "mcp", include: ["services/mcp/tests/*.test.ts"] },
				{
					name: "duckdb-fixtures",
					include: ["tests/duckdb-fixtures/*.test.mts"],
				},
			].map(({ name, include }) => ({
				extends: true as const,
				test: {
					name,
					include,
					maxWorkers: 2,
					testTimeout: 0,
					hookTimeout: 0,
					restoreMocks: true,
					sequence: { hooks: "list" as const, groupOrder: 1 },
				},
			})),
			{
				extends: true,
				// Unit tests need no generated data, so they run in CI. Imports
				// of generated datasets resolve to small fixtures instead.
				resolve: {
					alias: [
						{
							find: /^@\/public\/data\/datasets\/(.*)$/,
							replacement: `${FIXTURE_DATASETS}/$1`,
						},
					],
				},
				test: {
					name: "unit",
					include: [
						"tests/**/*.test.ts",
						"tests/data/**/*.test.mts",
						"packages/*/tests/**/*.test.ts",
					],
					exclude: [...configDefaults.exclude, BUILT_TESTS],
					sequence: { groupOrder: 0 },
				},
			},
			{
				extends: true,
				// Built tests need `pnpm data:build` (and `data/` restored), so
				// they run locally only. Some parse whole compiled artifacts
				// of up to 120 MB, so they run one file at a time to stay out
				// of swap.
				test: {
					name: "built",
					include: [BUILT_TESTS],
					fileParallelism: false,
					sequence: { groupOrder: 2 },
				},
			},
		],
	},
});
