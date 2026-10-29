import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

/** Tests that read generated data or the raw source data in data/. */
const BUILT_TESTS = "tests/built/**/*.test.ts";

const FIXTURE_DATASETS = fileURLToPath(
	new URL("tests/fixtures/datasets", import.meta.url),
);

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		globals: true,
		environment: "node",
		projects: [
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
						"pipeline/tests/**/*.test.ts",
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
					sequence: { groupOrder: 1 },
				},
			},
		],
	},
});
