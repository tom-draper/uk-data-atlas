import { stage } from "./build-data-stage.mjs";
import {
	websiteBoundaryInputs,
	websiteDatasetInputs,
} from "./build-data-inputs.mjs";

const chartRegistryFiles = [
	"lib/datasets/generated.ts",
	"lib/datasets/generatedCharts.tsx",
];

export const websiteStages = [
	stage(
		"boundaries",
		["sources"],
		["pipeline/src/stages/compile-boundaries.ts"],
		{
			rawInputs: websiteBoundaryInputs,
			writes: ["data/build/website-boundaries"],
			outputs: ["data/build/website-boundaries"],
		},
	),
	stage(
		"boundary-tiles",
		["boundaries"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/stages/compile-boundary-tiles.ts",
		],
		{
			memoryMb: 5120,
			compact: {
				memoryMb: 4096,
				variable: "ATLAS_PRECOMPILE_JOBS",
				workers: 1,
				normalWorkers: 2,
				normalBudgetMb: 5120,
			},
			writes: ["data/build/boundaries"],
			outputs: ["data/build/boundaries"],
			rawInputs: websiteBoundaryInputs,
		},
	),
	// Publishes the map resources and properties for the website to serve.
	stage(
		"website-tiles",
		["boundary-tiles"],
		["scripts/link-boundary-tiles.mts"],
		{
			writes: ["public/data/boundaries"],
			outputs: ["public/data/boundaries"],
			rawInputs: [],
			codeInputs: ["packages/areas/src/boundaryResources.ts"],
		},
	),
	// The website's pages and lookups, in a file of their own. Nothing in the
	// API's release (`atlas.sqlite`) is built from it, so the API stages do not
	// wait for it, and changing it does not invalidate them. Its lineage lookup
	// is derived from the release's change events, so it follows the assembly.
	stage(
		"website-lookups",
		["assemble-atlas", "atlas-lookups", "atlas-pages"],
		["pipeline/src/stages/build-atlas-assets.ts"],
		{
			writes: ["data/build/website-assets.sqlite"],
			rawInputs: [],
			requiredOutputs: ["data/build/website-assets.sqlite"],
		},
	),
	stage(
		"website-datasets",
		["atlas-sqlite", "assemble-atlas", "website-tiles", "website-lookups"],
		[
			"--import",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/stages/compile-website-data.ts",
		],
		{
			writes: ["public/data/datasets"],
			outputs: ["public/data/datasets"],
			rawInputs: websiteDatasetInputs,
			codeInputs: [
				"package.json",
				"packages/geography",
				"packages/geometry/package.json",
				"packages/geometry/src/tiles",
				"pipeline/src/precompile",
				"pipeline/src/stages/compile-boundaries.ts",
				"pipeline/src/geographies/boundaryReleaseSources.ts",
				"pipeline/src/geographies/boundaryBuildFiles.ts",
				"pipeline/src/geographies/correctBoundarySource.ts",
				"packages/geography/src/reverseGridOffset.ts",
				"packages/atlas-db/src/buildTiming.ts",
				"pipeline/src/stages/compile-boundary-tiles.ts",
				"pipeline/src/lib/args.ts",
				"scripts/generate-dataset-registry.ts",
			],
		},
	),
	stage(
		"website-registry",
		["website-datasets"],
		["--import", "tsx", "scripts/generate-dataset-registry.ts"],
		{
			exclusive: true,
			rawInputs: [],
			requiredOutputs: chartRegistryFiles,
			// The chart and catalogue definitions are imported by path.
			codeInputs: [
				"lib",
				"packages/datasets",
				".prettierrc",
				"package.json",
			],
		},
	),
];
