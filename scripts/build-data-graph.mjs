const stage = (
	name,
	dependencies = [],
	args = ["exec", "tsx", `scripts/build-${name}.ts`],
	{
		cacheable = true,
		outputs = [],
		requiredOutputs = [],
		codeInputs = [],
	} = {},
) => ({
	name,
	dependencies,
	args,
	cacheable,
	outputs,
	requiredOutputs,
	codeInputs,
});

const apiStages = [
	// Always runs. It is quick when data/ already matches the pinned release.
	stage("sources", [], ["data:download"], {
		cacheable: false,
	}),
	stage(
		"operations",
		[],
		["exec", "tsx", "pipeline/src/build-operations.ts"],
		{
			codeInputs: [
				"services/api/openapi.yaml",
				"pipeline/package.json",
				"pipeline/tsconfig.json",
			],
		},
	),
	stage(
		"catalogue-registry",
		["sources"],
		["exec", "tsx", "pipeline/src/build-catalogue-registry.ts"],
		{ cacheable: false },
	),
	// Compiled once into data/build/datasets, for the website and the API.
	stage(
		"datasets",
		["catalogue-registry"],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/compile-datasets.mts",
		],
		{
			outputs: ["data/build/datasets"],
			codeInputs: [
				"pipeline/package.json",
				"pipeline/tsconfig.json",
				"pipeline/src/precompile",
			],
		},
	),
	stage(
		"terrain-catalogue",
		[],
		["exec", "tsx", "pipeline/src/build-terrain-catalogue.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"atlas-sqlite",
		[
			"terrain-catalogue",
			"datasets",
			"area-inventory",
			"crosswalk-inventory",
			"named-locations",
			"location-projections",
		],
		["exec", "tsx", "pipeline/src/build-atlas-sqlite.ts"],
		{
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			requiredOutputs: [
				"data/build/atlas-base.sqlite",
				"data/build/atlas-cache.sqlite",
			],
		},
	),
	stage(
		"api-datasets",
		["sources"],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/build-api-datasets.mts",
		],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"boundary-registry",
		["sources"],
		["exec", "tsx", "pipeline/src/build-boundary-registry.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"derived-boundaries",
		["sources"],
		["exec", "tsx", "pipeline/src/build-derived-boundaries.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"area-inventory",
		["boundary-registry", "derived-boundaries"],
		["exec", "tsx", "pipeline/src/build-area-inventory.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"geometry-source-registry",
		["area-inventory"],
		["exec", "tsx", "pipeline/src/build-geometry-source-registry.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"geometry-store",
		["geometry-source-registry"],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/build-geometry-store.ts",
		],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"named-locations",
		["area-inventory", "geometry-store", "api-datasets"],
		["exec", "tsx", "pipeline/src/build-named-locations.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"place-index",
		[
			"geography-catalogues",
			"assemble-atlas",
			"atlas-sqlite",
			"boundary-registry",
			"area-inventory",
			"named-locations",
		],
		["exec", "tsx", "pipeline/src/build-place-index.ts"],
		{
			cacheable: false,
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"area-search-index",
		["assemble-atlas"],
		["exec", "tsx", "pipeline/src/build-area-search-index.ts"],
		{
			cacheable: false,
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"postcode-index",
		["sources"],
		["exec", "tsx", "pipeline/src/build-postcode-index.ts"],
		{
			requiredOutputs: ["data/build/postcode-index.sqlite"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"statistics-vocabulary",
		["atlas-sqlite"],
		["exec", "tsx", "pipeline/src/build-statistics-vocabulary.ts"],
		{
			requiredOutputs: ["data/build/statistics-vocabulary.json"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"data-catalog",
		["datasets", "statistics-vocabulary"],
		["exec", "tsx", "pipeline/src/build-data-catalog.ts"],
		{
			requiredOutputs: [
				"data/build/observations.sqlite",
				"data/build/measure-statistics-fields.json",
			],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"assemble-atlas",
		[
			"atlas-sqlite",
			"data-catalog",
			"geography-catalogues",
			"postcode-index",
			"postcode-areas",
			"website-lookups",
		],
		["exec", "tsx", "pipeline/src/assemble-atlas.ts"],
		{
			requiredOutputs: ["data/build/atlas.sqlite"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"measure-compatibility",
		["data-catalog", "boundary-registry", "area-inventory"],
		["exec", "tsx", "pipeline/src/build-measure-compatibility.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"statistics-read-path",
		["atlas-sqlite", "data-catalog", "statistics-vocabulary"],
		["exec", "tsx", "pipeline/src/build-statistics-read-path.ts"],
		{
			requiredOutputs: ["data/build/statistics-read-path.json"],
			codeInputs: [
				"pipeline/package.json",
				"pipeline/tsconfig.json",
				"services/api/config/measure-dimensions.json",
			],
		},
	),
	stage(
		"export-manifest",
		["data-catalog", "atlas-sqlite", "statistics-read-path"],
		["exec", "tsx", "pipeline/src/build-export-manifest.ts"],
		{
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"postcode-areas",
		[
			"geography-catalogues",
			"atlas-sqlite",
			"postcode-index",
			"area-inventory",
			"geometry-store",
			"measure-compatibility",
		],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/build-postcode-areas.ts",
		],
		{
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			outputs: ["data/build/postcode-areas-component"],
			requiredOutputs: [
				"data/build/postcode-areas-component/manifest.json",
			],
		},
	),
	stage(
		"postcode-counts",
		["postcode-index", "assemble-atlas"],
		["exec", "tsx", "pipeline/src/build-postcode-counts.ts"],
		{ cacheable: false },
	),
	stage(
		"crosswalk-inventory",
		["area-inventory", "geometry-source-registry"],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/build-crosswalk-inventory.ts",
		],
		{
			codeInputs: [
				"pipeline/src/crosswalk-worker.ts",
				"pipeline/package.json",
				"pipeline/tsconfig.json",
			],
		},
	),
	stage(
		"relationship-paths",
		["crosswalk-inventory"],
		["exec", "tsx", "pipeline/src/build-relationship-paths.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"analysis-geographies",
		["data-catalog", "crosswalk-inventory", "relationship-paths"],
		["exec", "tsx", "pipeline/src/build-analysis-geographies.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"analysis-geography-validation",
		["analysis-geographies", "data-catalog", "crosswalk-inventory"],
		["exec", "tsx", "pipeline/src/build-analysis-geography-validation.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"geography-catalogues",
		[
			"boundary-registry",
			"geography-inventory",
			"relationship-paths",
			"analysis-geographies",
			"analysis-geography-validation",
		],
		["exec", "tsx", "pipeline/src/build-geography-catalogues.ts"],
		{
			requiredOutputs: ["data/build/geography-payloads.json"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"location-projections",
		["named-locations", "crosswalk-inventory", "area-inventory"],
		["exec", "tsx", "pipeline/src/build-location-projections.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"relationship-candidates",
		["area-inventory", "crosswalk-inventory"],
		["exec", "tsx", "pipeline/src/build-relationship-candidates.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"geography-inventory",
		[
			"sources",
			"boundary-registry",
			"area-inventory",
			"crosswalk-inventory",
		],
		["exec", "tsx", "pipeline/src/build-geography-inventory.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"lookup-manifest",
		["area-inventory", "crosswalk-inventory", "named-locations"],
		["exec", "tsx", "pipeline/src/build-lookup-manifest.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"map-resource",
		["boundary-registry", "area-inventory", "geometry-source-registry"],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/build-map-resource.ts",
		],
		{
			outputs: ["data/build/map-resources"],
			codeInputs: [
				"packages/atlas-runtime/src/maps/mapResource",
				"pipeline/src/compileGeometryValidity.ts",
			],
		},
	),
	stage(
		"validation-report",
		[
			"boundary-registry",
			"area-inventory",
			"geometry-source-registry",
			"crosswalk-inventory",
			"relationship-candidates",
			"geography-inventory",
			"data-catalog",
			"export-manifest",
		],
		["exec", "tsx", "pipeline/src/build-validation-report.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"atlas-release-initial",
		[
			"geography-catalogues",
			"atlas-sqlite",
			"boundary-registry",
			"derived-boundaries",
			"area-inventory",
			"named-locations",
			"place-index",
			"area-search-index",
			"postcode-index",
			"postcode-areas",
			"postcode-counts",
			"location-projections",
			"data-catalog",
			"measure-compatibility",
			"export-manifest",
			"lookup-manifest",
			"map-resource",
			"geometry-source-registry",
			"crosswalk-inventory",
			"analysis-geographies",
			"analysis-geography-validation",
			"relationship-paths",
			"relationship-candidates",
			"geography-inventory",
			"validation-report",
			"terrain-catalogue",
		],
		["exec", "tsx", "pipeline/src/build-atlas-release.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"documents",
		[
			"atlas-sqlite",
			"atlas-release-initial",
			"operations",
			"geometry-store",
		],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/build-evidence-documents.ts",
		],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"atlas-lookups",
		[
			"geography-catalogues",
			"atlas-sqlite",
			"area-inventory",
			"crosswalk-inventory",
			"relationship-paths",
		],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/build-atlas-lookups.ts",
		],
		{
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			outputs: ["data/build/atlas-assets/atlas-lookups"],
			requiredOutputs: ["data/build/atlas-assets/atlas-lookups.json"],
		},
	),
	stage(
		"atlas-cache-stamp",
		[
			"place-index",
			"area-search-index",
			"postcode-counts",
			"assemble-atlas",
		],
		["exec", "tsx", "pipeline/src/stamp-atlas-cache.ts"],
		{
			cacheable: false,
			requiredOutputs: ["data/build/atlas-cache.sqlite"],
		},
	),
	stage(
		"atlas-release",
		[
			"atlas-release-initial",
			"documents",
			"atlas-lookups",
			"assemble-atlas",
			"atlas-cache-stamp",
		],
		["exec", "tsx", "pipeline/src/build-atlas-release.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	// Place pages read areas, crosswalks, geometry and named locations; the
	// docs catalogue reads the API's catalogue and map resource manifests.
	stage(
		"atlas-pages",
		[
			"geography-catalogues",
			"atlas-sqlite",
			"api-datasets",
			"boundary-registry",
			"geometry-store",
			"named-locations",
			"location-projections",
			"relationship-paths",
			"data-catalog",
			"export-manifest",
			"geography-inventory",
			"map-resource",
		],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/build-atlas-pages.ts",
		],
		{
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			outputs: ["data/build/atlas-assets/atlas-pages"],
			requiredOutputs: ["data/build/atlas-assets/atlas-pages.json"],
		},
	),
];

const websiteStages = [
	stage(
		"boundaries",
		["sources"],
		["exec", "tsx", "pipeline/src/compile-boundaries.mts"],
		{
			outputs: ["data/build/website-boundaries"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"boundary-tiles",
		["boundaries"],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/compile-boundary-tiles.mts",
		],
		{
			outputs: ["data/build/boundaries"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	// Publishes the map resources and properties for the website to serve.
	stage(
		"website-tiles",
		["boundary-tiles"],
		["exec", "tsx", "scripts/link-boundary-tiles.ts"],
		{
			outputs: ["public/data/boundaries"],
			codeInputs: [
				"packages/atlas-runtime/src/areas/boundaryResources.ts",
			],
		},
	),
	stage(
		"website-lookups",
		["atlas-lookups", "atlas-pages"],
		["exec", "tsx", "pipeline/src/build-atlas-assets.ts"],
		{
			requiredOutputs: ["data/build/website-assets.sqlite"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"website-datasets",
		["atlas-sqlite", "assemble-atlas", "website-tiles"],
		[
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"scripts/compile-website-data.mts",
		],
		{
			outputs: ["public/data/datasets"],
			codeInputs: [
				"package.json",
				"packages/geography",
				"packages/map-tiles",
				"scripts/precompile",
				"pipeline/src/compile-boundaries.mts",
				"packages/geography/src/reverseGridOffset.ts",
				"packages/atlas-runtime/src/storage/buildTiming.ts",
				"pipeline/src/compile-boundary-tiles.mts",
				"scripts/generate-dataset-registry.ts",
			],
		},
	),
	stage(
		"website-registry",
		["website-datasets"],
		["exec", "tsx", "scripts/generate-dataset-registry.ts"],
		{ cacheable: false },
	),
];

export const buildDataStages = [...apiStages, ...websiteStages];
