import { configDefaults, defineConfig } from "vitest/config";

/** Tests that read generated data or the raw source data in data/. */
const BUILT_TESTS = "tests/built/**/*.test.ts";

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
				test: {
					name: "unit",
					include: [
						"tests/**/*.test.ts",
						"packages/*/tests/**/*.test.ts",
					],
					exclude: [...configDefaults.exclude, BUILT_TESTS],
					sequence: { groupOrder: 0 },
				},
			},
			{
				extends: true,
				// Built tests need `pnpm precompile` (and `data/` restored), so
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
