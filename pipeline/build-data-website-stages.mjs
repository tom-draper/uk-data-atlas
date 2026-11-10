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
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
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
			writes: ["data/build/boundaries"],
			outputs: ["data/build/boundaries"],
			rawInputs: websiteBoundaryInputs,
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
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
	// wait for it, and changing it does not invalidate them.
	stage(
		"website-lookups",
		["atlas-lookups", "atlas-pages"],
		["pipeline/src/stages/build-atlas-assets.ts"],
		{
			writes: ["data/build/website-assets.sqlite"],
			rawInputs: [],
			requiredOutputs: ["data/build/website-assets.sqlite"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
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
				"packages/map-tiles",
				"pipeline/src/precompile",
				"pipeline/src/stages/compile-boundaries.ts",
				"pipeline/src/geographies/boundaryReleaseSources.ts",
				"pipeline/src/geographies/boundaryBuildFiles.ts",
				"pipeline/src/geographies/correctBoundarySource.ts",
				"packages/geography/src/reverseGridOffset.ts",
				"packages/atlas-db/src/buildTiming.ts",
				"pipeline/src/stages/compile-boundary-tiles.ts",
				"scripts/generate-dataset-registry.ts",
			],
		},
	),
	// The arrays the map colours areas from use database-backed datasets and
	// boundary sidecars.
	stage(
		"website-map-values",
		["website-datasets"],
		["--import", "tsx", "pipeline/src/stages/build-map-values.ts"],
		{
			writes: ["public/data/map-values"],
			outputs: ["public/data/map-values"],
			rawInputs: [],
			codeInputs: [
				"package.json",
				"packages/datasets",
				"packages/map-tiles",
				"pipeline/src/precompile/paths.ts",
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
