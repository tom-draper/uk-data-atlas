import { configDefaults, defineConfig } from "vitest/config";

/**
 * Suites that parse whole compiled artifacts: the boundary TopoJSON, about
 * 120 MB, and precompiled datasets of up to 17 MB. Run beside each other and
 * everything else they fill memory and push the machine into swap, where a
 * 17-second suite can pass a minute. They run afterwards, one file at a time.
 */
const HEAVY_DATA_TESTS = [
	"tests/data/compiledBoundaryAssets.test.ts",
	"tests/data/datasetBoundaryYears.test.ts",
	"tests/data/datasetRegionChunks.test.ts",
	"tests/data/datasetRegistry.test.ts",
];

/**
 * Suites that read the raw source data restored into data/ by
 * `pnpm data:download`. CI never restores it, so these run only locally,
 * through `pnpm check`.
 */
const SOURCE_DATA_TESTS = [
	"tests/data/boundaryMeta.test.ts",
	"tests/data/boundaryReleases.test.ts",
	"tests/data/gridOffset.test.ts",
];

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
					include: ["tests/**/*.test.ts"],
					exclude: [
						...configDefaults.exclude,
						...HEAVY_DATA_TESTS,
						...SOURCE_DATA_TESTS,
					],
					sequence: { groupOrder: 0 },
				},
			},
			{
				extends: true,
				test: {
					name: "data",
					include: HEAVY_DATA_TESTS,
					fileParallelism: false,
					sequence: { groupOrder: 1 },
				},
			},
			{
				extends: true,
				test: {
					name: "source",
					include: SOURCE_DATA_TESTS,
					fileParallelism: false,
					sequence: { groupOrder: 2 },
				},
			},
		],
	},
});
