import { sourcesMatchRelease } from "../scripts/data-release.mjs";
import { ATLAS_CACHE_WORK } from "./src/storage/atlasCacheWork.ts";
import { CACHE_STAGES } from "./src/storage/stageStamp.ts";
import { stage, checkStage, stampOf } from "./build-data-stage.mjs";
import {
	datasetInputs,
	crosswalkInputs,
	sourceMetadataInputs,
	boundaryRegistryInputs,
	derivedBoundaryInputs,
	areaInventoryInputs,
	geometrySourceRegistryInputs,
	geometryStoreInputs,
	boundaryOffsetInputs,
	apiDatasetInputs,
	censusSmallAreaInputs,
	crosswalkWeightInputs,
	postcodeInputs,
} from "./build-data-inputs.mjs";

// Checked-in files the registry stages generate. Other stages import them.
const catalogueRegistry = "packages/datasets/src/data/catalog";
const catalogueFiles = [
	`${catalogueRegistry}/definitions/index.ts`,
	`${catalogueRegistry}/registry.ts`,
	`${catalogueRegistry}/generated.ts`,
	"packages/datasets/src/data/declarations.ts",
];
// The atlas cache is one file with several writers. Each stage after the base
// build adds tables to it, and tracks them through a stamp of its own. They
// add to one working copy, which `atlas-cache-stamp` publishes.
const atlasCache = "data/build/atlas-cache.sqlite";
const cacheWorkingCopy = {
	shared: [atlasCache],
	scratch: [ATLAS_CACHE_WORK],
	finishedBy: "atlas-cache-stamp",
};

const artifacts = "data/build/artifacts";
const atlasAssets = "data/build/atlas-assets";
const geography = "data/build/geography";

// Declare paths changed beyond outputs and requiredOutputs. Stages sharing a
// path do not run together; stages without declared paths run alone.
export const apiStages = [
	// Always runs, as a download can change any raw file and needs the network.
	// It is skipped when data/source already matches the pinned release.
	stage("sources", [], ["data:download"], {
		cacheable: false,
		isCurrent: () => sourcesMatchRelease(),
	}),
	stage("operations", [], ["pipeline/src/stages/build-operations.ts"], {
		rawInputs: [],
		writes: [`${artifacts}/operations.json`],
		codeInputs: [
			"services/api/openapi.yaml",
			"pipeline/package.json",
			"pipeline/tsconfig.json",
		],
	}),
	stage(
		"catalogue-registry",
		["sources"],
		["pipeline/src/stages/build-catalogue-registry.ts"],
		{
			// Writes files other stages import, so nothing runs beside it.
			exclusive: true,
			rawInputs: [],
			requiredOutputs: catalogueFiles,
			// The definitions are imported by path, not statically, and the
			// output is formatted with the repository's Prettier config.
			codeInputs: [
				"packages/datasets",
				".prettierrc",
				"pipeline/package.json",
				"pipeline/tsconfig.json",
			],
		},
	),
	// Compiled once into data/build/datasets, for the website and the API.
	stage(
		"datasets",
		["catalogue-registry"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/stages/compile-datasets.ts",
		],
		{
			writes: ["data/build/datasets"],
			outputs: ["data/build/datasets"],
			rawInputs: datasetInputs,
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
		["pipeline/src/stages/build-terrain-catalogue.ts"],
		{
			rawInputs: [],
			writes: [`${artifacts}/terrain-catalogue.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
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
		["pipeline/src/stages/build-atlas-sqlite.ts"],
		{
			writes: [
				"data/build/atlas-base.sqlite",
				atlasCache,
				ATLAS_CACHE_WORK,
				...CACHE_STAGES.map(stampOf),
			],
			rawInputs: censusSmallAreaInputs,
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			requiredOutputs: [
				"data/build/atlas-base.sqlite",
				"data/build/atlas-cache.sqlite",
			],
		},
	),
	// A check stage: it reads the cache `atlas-sqlite` wrote and compares each
	// generated dataset payload with the compiler's copy. See `checkStage`.
	checkStage(
		"verify-dataset-payloads",
		["datasets", "atlas-sqlite"],
		["pipeline/src/stages/verify-dataset-payloads.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"api-datasets",
		["sources"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-api-datasets.ts",
		],
		{
			rawInputs: apiDatasetInputs,
			writes: [`${artifacts}/source-data`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"boundary-registry",
		["sources"],
		["pipeline/src/stages/build-boundary-registry.ts"],
		{
			rawInputs: boundaryRegistryInputs,
			writes: [`${geography}/boundary-releases.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"derived-boundaries",
		["sources"],
		["pipeline/src/stages/build-derived-boundaries.ts"],
		{
			rawInputs: derivedBoundaryInputs,
			writes: [`${artifacts}/boundaries`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"area-inventory",
		["boundary-registry", "derived-boundaries"],
		["pipeline/src/stages/build-area-inventory.ts"],
		{
			rawInputs: areaInventoryInputs,
			writes: [`${artifacts}/areas`, `${artifacts}/area-inventory.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"geometry-source-registry",
		["area-inventory"],
		["pipeline/src/stages/build-geometry-source-registry.ts"],
		{
			rawInputs: geometrySourceRegistryInputs,
			writes: [`${artifacts}/geometry-sources.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"geometry-store",
		["geometry-source-registry"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-geometry-store.ts",
		],
		{
			rawInputs: geometryStoreInputs,
			writes: [`${artifacts}/geometry-store`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"named-locations",
		["area-inventory", "geometry-store", "api-datasets"],
		["pipeline/src/stages/build-named-locations.ts"],
		{
			rawInputs: [
				"geography/ceremonial-counties/source/Boundary-line-ceremonial-counties_region.shp",
				"geography/ceremonial-counties/source/Boundary-line-ceremonial-counties_region.dbf",
				"geography/historic-counties/source/Boundary-line-historic-counties_region.shp",
				"geography/historic-counties/source/Boundary-line-historic-counties_region.dbf",
			],
			writes: [
				`${artifacts}/location-geometries`,
				`${artifacts}/named-locations.json`,
				`${artifacts}/named-locations-metadata.json`,
			],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
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
		["pipeline/src/stages/build-place-index.ts"],
		{
			rawInputs: [],
			...cacheWorkingCopy,
			requiredOutputs: [stampOf("place-index")],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"area-search-index",
		["assemble-atlas"],
		["pipeline/src/stages/build-area-search-index.ts"],
		{
			rawInputs: [],
			...cacheWorkingCopy,
			requiredOutputs: [stampOf("area-search-index")],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"postcode-index",
		["sources"],
		["pipeline/src/stages/build-postcode-index.ts"],
		{
			writes: ["data/build/postcode-index.sqlite"],
			requiredOutputs: ["data/build/postcode-index.sqlite"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			rawInputs: postcodeInputs,
		},
	),
	stage(
		"statistics-vocabulary",
		["atlas-sqlite"],
		["pipeline/src/stages/build-statistics-vocabulary.ts"],
		{
			writes: ["data/build/statistics-vocabulary.json"],
			rawInputs: [],
			requiredOutputs: ["data/build/statistics-vocabulary.json"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"data-catalog",
		["datasets", "statistics-vocabulary"],
		["pipeline/src/stages/build-data-catalog.ts"],
		{
			writes: [
				`${artifacts}/data-catalog.json`,
				"data/build/compiled-observations",
				"data/build/measure-statistics-fields.json",
			],
			rawInputs: censusSmallAreaInputs,
			requiredOutputs: [
				"data/build/compiled-observations",
				"data/build/measure-statistics-fields.json",
			],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	// Places the postcodes, and the output areas without one, in each release a
	// crosswalk to weigh joins, one release at a time. The placements are kept
	// beside the result only to skip releases that have not changed.
	stage(
		"crosswalk-weights",
		["atlas-sqlite", "geometry-store", "geometry-source-registry"],
		[
			"--max-old-space-size=4096",
			"pipeline/src/stages/build-crosswalk-weights.ts",
		],
		{
			rawInputs: crosswalkWeightInputs,
			writes: ["data/build/crosswalk-weights"],
			outputs: ["data/build/crosswalk-weights"],
			requiredOutputs: [
				"data/build/crosswalk-weights/crosswalk-weights.sqlite",
			],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	// Converts figures whose answer is published elsewhere and measures the
	// error, which is what the bounds of every converted value come from.
	stage(
		"conversion-backtest",
		["atlas-sqlite", "crosswalk-weights"],
		["pipeline/src/stages/build-conversion-backtest.ts"],
		{
			rawInputs: [],
			writes: ["data/build/conversion-backtest"],
			outputs: ["data/build/conversion-backtest"],
			requiredOutputs: [
				"data/build/conversion-backtest/conversion-backtest.sqlite",
				"data/build/conversion-backtest/backtest-tables.md",
			],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	// Moves published series onto the latest releases under the rules the
	// backtest supports. Every value is marked as converted.
	stage(
		"converted-series",
		["atlas-sqlite", "crosswalk-weights", "conversion-backtest"],
		["pipeline/src/stages/build-converted-series.ts"],
		{
			rawInputs: [],
			writes: ["data/build/converted-series"],
			outputs: ["data/build/converted-series"],
			requiredOutputs: [
				"data/build/converted-series/converted-series.sqlite",
				"data/build/converted-series/converted-series.md",
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
			"crosswalk-weights",
			"converted-series",
		],
		["pipeline/src/stages/assemble-atlas.ts"],
		{
			writes: ["data/build/atlas.sqlite"],
			rawInputs: [],
			requiredOutputs: ["data/build/atlas.sqlite"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"measure-compatibility",
		[
			"data-catalog",
			"boundary-registry",
			"area-inventory",
			"statistics-read-path",
		],
		["pipeline/src/stages/build-measure-compatibility.ts"],
		{
			rawInputs: [],
			writes: [`${artifacts}/measure-compatibility.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"statistics-read-path",
		["atlas-sqlite", "data-catalog", "statistics-vocabulary"],
		["pipeline/src/stages/build-statistics-read-path.ts"],
		{
			writes: ["data/build/statistics-read-path.json"],
			rawInputs: [],
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
		["pipeline/src/stages/build-export-manifest.ts"],
		{
			writes: [
				`${artifacts}/exports`,
				`${artifacts}/export-manifest.json`,
			],
			rawInputs: [],
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
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-postcode-areas.ts",
		],
		{
			writes: ["data/build/postcode-areas-component"],
			rawInputs: [],
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
		["pipeline/src/stages/build-postcode-counts.ts"],
		{
			rawInputs: [],
			...cacheWorkingCopy,
			requiredOutputs: [stampOf("postcode-counts")],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	// Reads the stored placements back and asks the geometry again for a sample.
	checkStage(
		"verify-postcode-areas",
		[
			"postcode-areas",
			"postcode-index",
			"geometry-source-registry",
			"geometry-store",
		],
		["pipeline/src/stages/verify-postcode-areas.ts"],
		{
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	// The atoms crosswalk weights are summed over, placed in the releases the
	// postcode-overlap crosswalks join, which are compiled from them.
	stage(
		"weight-atoms",
		["area-inventory", "geometry-store", "geometry-source-registry"],
		[
			"--max-old-space-size=4096",
			"pipeline/src/stages/build-weight-atoms.ts",
		],
		{
			rawInputs: crosswalkWeightInputs,
			writes: ["data/build/weight-atoms"],
			outputs: ["data/build/weight-atoms"],
			requiredOutputs: ["data/build/weight-atoms/atoms.json"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"crosswalk-inventory",
		["area-inventory", "geometry-source-registry", "weight-atoms"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-crosswalk-inventory.ts",
		],
		{
			writes: [
				`${artifacts}/crosswalks`,
				`${artifacts}/crosswalk-inventory.json`,
			],
			rawInputs: crosswalkInputs,
			codeInputs: [
				"pipeline/src/relationships/crosswalk-worker.ts",
				"pipeline/package.json",
				"pipeline/tsconfig.json",
			],
		},
	),
	stage(
		"relationship-paths",
		// Reads each crosswalk's shape from the edges in atlas-base.sqlite.
		["crosswalk-inventory", "atlas-sqlite"],
		["pipeline/src/stages/build-relationship-paths.ts"],
		{
			rawInputs: [],
			writes: [`${geography}/relationship-paths.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"analysis-geographies",
		["data-catalog", "crosswalk-inventory", "relationship-paths"],
		["pipeline/src/stages/build-analysis-geographies.ts"],
		{
			rawInputs: [],
			writes: [`${geography}/analysis-geographies.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"analysis-geography-validation",
		[
			"analysis-geographies",
			"data-catalog",
			"crosswalk-inventory",
			"statistics-read-path",
		],
		["pipeline/src/stages/build-analysis-geography-validation.ts"],
		{
			rawInputs: [],
			writes: [`${geography}/analysis-geography-validation.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
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
		["pipeline/src/stages/build-geography-catalogues.ts"],
		{
			writes: ["data/build/geography-payloads.json"],
			rawInputs: [],
			requiredOutputs: ["data/build/geography-payloads.json"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"location-projections",
		["named-locations", "crosswalk-inventory", "area-inventory"],
		["pipeline/src/stages/build-location-projections.ts"],
		{
			rawInputs: [],
			writes: ["data/build/location-projections"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"relationship-candidates",
		["area-inventory", "crosswalk-inventory"],
		["pipeline/src/stages/build-relationship-candidates.ts"],
		{
			rawInputs: areaInventoryInputs,
			writes: [`${artifacts}/relationship-candidates.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"geography-inventory",
		[
			"sources",
			"boundary-registry",
			"area-inventory",
			"crosswalk-inventory",
		],
		["pipeline/src/stages/build-geography-inventory.ts"],
		{
			rawInputs: sourceMetadataInputs,
			writes: [`${geography}/geography-inventory.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"lookup-manifest",
		["area-inventory", "crosswalk-inventory", "named-locations"],
		["pipeline/src/stages/build-lookup-manifest.ts"],
		{
			rawInputs: [],
			writes: [`${artifacts}/lookup-manifest.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"map-resource",
		["boundary-registry", "area-inventory", "geometry-source-registry"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-map-resource.ts",
		],
		{
			writes: [
				"data/build/map-resources",
				`${artifacts}/map-resources.json`,
			],
			outputs: ["data/build/map-resources"],
			rawInputs: geometryStoreInputs,
			codeInputs: [
				"packages/map-tiles/src/node/mapResource",
				"pipeline/src/maps/compileGeometryValidity.ts",
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
		["pipeline/src/stages/build-validation-report.ts"],
		{
			rawInputs: [],
			writes: [`${artifacts}/validation-report.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
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
			"atlas-cache-stamp",
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
		["pipeline/src/stages/build-atlas-release.ts"],
		{
			rawInputs: [],
			writes: [`${artifacts}/atlas-release.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
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
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-evidence-documents.ts",
		],
		{
			writes: [
				`${artifacts}/documents`,
				`${artifacts}/evidence-documents.json`,
			],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			rawInputs: boundaryOffsetInputs,
		},
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
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-atlas-lookups.ts",
		],
		{
			writes: [
				`${atlasAssets}/atlas-lookups`,
				`${atlasAssets}/atlas-lookups.json`,
			],
			rawInputs: [],
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
		["pipeline/src/stages/stamp-atlas-cache.ts"],
		{
			writes: [atlasCache],
			rawInputs: [],
			// Publishes the working copy, so it owns the file and notices any
			// change to it.
			requiredOutputs: [atlasCache, stampOf("atlas-cache-stamp")],
			scratch: [ATLAS_CACHE_WORK],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
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
		["pipeline/src/stages/build-atlas-release.ts"],
		{
			rawInputs: [],
			writes: [`${artifacts}/atlas-release.json`],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
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
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-atlas-pages.ts",
		],
		{
			writes: [
				`${atlasAssets}/atlas-pages`,
				`${atlasAssets}/atlas-pages.json`,
			],
			rawInputs: boundaryOffsetInputs,
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			outputs: ["data/build/atlas-assets/atlas-pages"],
			requiredOutputs: ["data/build/atlas-assets/atlas-pages.json"],
		},
	),
];
