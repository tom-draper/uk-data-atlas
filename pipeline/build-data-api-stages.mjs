import { sourcesMatchRelease } from "../scripts/data-release.mjs";
import { stage, checkStage } from "./build-data-stage.mjs";
import {
	countyShapeInputs,
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
	"packages/datasets/src/declaration/declaredGuides.ts",
	"packages/datasets/src/declaration/declaredSources.ts",
];
// The atlas cache is assembled from parts. A stage that builds a component of
// it keeps that component in a file of its own, and `assemble-cache` is the
// only stage that writes the cache.
const atlasCache = "data/build/atlas-cache.sqlite";
const cachePart = (component) =>
	`data/build/atlas-cache-parts/${component}.sqlite`;
const atlasBase = "data/build/atlas-base.sqlite";
const atlasBaseMetadata = "data/build/atlas-base-build.sqlite";
const atlasBaseCacheParts = [cachePart("projections"), cachePart("datasets")];
const crosswalkWeights =
	"data/build/crosswalk-weights/crosswalk-weights.sqlite";
const conversionBacktest =
	"data/build/conversion-backtest/conversion-backtest.sqlite";
const convertedSeries = "data/build/converted-series/converted-series.sqlite";

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
			memoryMb: 6144,
			compact: {
				memoryMb: 2176,
				variable: "ATLAS_PRECOMPILE_JOBS",
				workers: 1,
				normalWorkers: 2,
			},
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
		[
			// Leave room for planning, SQLite writes and reading direct sources
			// when a normalized parts file is unavailable.
			"--max-old-space-size=4096",
			"pipeline/src/stages/build-atlas-sqlite.ts",
		],
		{
			memoryMb: 4672,
			writes: [atlasBase, atlasBaseMetadata, ...atlasBaseCacheParts],
			rawInputs: censusSmallAreaInputs,
			requiredOutputs: [
				atlasBase,
				atlasBaseMetadata,
				...atlasBaseCacheParts,
			],
		},
	),
	// A check stage: it reads the cache `assemble-cache` wrote and compares each
	// generated dataset payload with the compiler's copy. See `checkStage`.
	checkStage(
		"verify-dataset-payloads",
		["datasets", "atlas-sqlite", "assemble-cache"],
		["pipeline/src/stages/verify-dataset-payloads.ts"],
	),
	stage(
		"api-datasets",
		["sources"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-api-datasets.ts",
		],
		{
			memoryMb: 1408,
			rawInputs: apiDatasetInputs,
			writes: [`${artifacts}/source-data`],
		},
	),
	stage(
		"boundary-registry",
		["sources"],
		["pipeline/src/stages/build-boundary-registry.ts"],
		{
			rawInputs: boundaryRegistryInputs,
			writes: [`${geography}/boundary-releases.json`],
		},
	),
	stage(
		"derived-boundaries",
		["sources"],
		["pipeline/src/stages/build-derived-boundaries.ts"],
		{
			rawInputs: derivedBoundaryInputs,
			writes: [`${artifacts}/boundaries`],
		},
	),
	stage(
		"area-inventory",
		["boundary-registry", "derived-boundaries"],
		["pipeline/src/stages/build-area-inventory.ts"],
		{
			memoryMb: 1600,
			rawInputs: areaInventoryInputs,
			writes: [`${artifacts}/areas`, `${artifacts}/area-inventory.json`],
		},
	),
	stage(
		"geometry-source-registry",
		["area-inventory"],
		["pipeline/src/stages/build-geometry-source-registry.ts"],
		{
			rawInputs: geometrySourceRegistryInputs,
			writes: [`${artifacts}/geometry-sources.json`],
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
			memoryMb: 4096,
			rawInputs: geometryStoreInputs,
			outputs: [`${artifacts}/geometry-store`],
			requiredOutputs: [`${artifacts}/geometry-store/build-state.json`],
		},
	),
	stage(
		"named-locations",
		["area-inventory", "geometry-store", "api-datasets"],
		["pipeline/src/stages/build-named-locations.ts"],
		{
			memoryMb: 2624,
			rawInputs: countyShapeInputs,
			writes: [
				`${artifacts}/location-geometries`,
				`${artifacts}/named-locations.json`,
				`${artifacts}/named-locations-metadata.json`,
			],
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
			memoryMb: 1984,
			rawInputs: [],
			writes: [cachePart("place-index")],
			requiredOutputs: [cachePart("place-index")],
		},
	),
	stage(
		"area-search-index",
		["assemble-atlas"],
		["pipeline/src/stages/build-area-search-index.ts"],
		{
			memoryMb: 1792,
			rawInputs: [],
			writes: [cachePart("area-search")],
			requiredOutputs: [cachePart("area-search")],
		},
	),
	stage(
		"postcode-index",
		["sources"],
		["pipeline/src/stages/build-postcode-index.ts"],
		{
			memoryMb: 1280,
			writes: [
				"data/build/postcode-index.sqlite",
				"data/build/postcode-index-build.sqlite",
			],
			requiredOutputs: [
				"data/build/postcode-index.sqlite",
				"data/build/postcode-index-build.sqlite",
			],
			rawInputs: postcodeInputs,
		},
	),
	stage(
		"statistics-vocabulary",
		["atlas-sqlite"],
		["pipeline/src/stages/build-statistics-vocabulary.ts"],
		{
			dependencyOutputs: { "atlas-sqlite": [atlasBase] },
			writes: ["data/build/statistics-vocabulary.json"],
			rawInputs: [],
			requiredOutputs: ["data/build/statistics-vocabulary.json"],
		},
	),
	stage(
		"data-catalog",
		["datasets", "statistics-vocabulary"],
		["pipeline/src/stages/build-data-catalog.ts"],
		{
			memoryMb: 1536,
			writes: [`${artifacts}/data-catalog.json`],
			rawInputs: censusSmallAreaInputs,
			requiredOutputs: [`${artifacts}/data-catalog.json`],
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
			memoryMb: 1280,
			rawInputs: crosswalkWeightInputs,
			writes: ["data/build/crosswalk-weights"],
			outputs: ["data/build/crosswalk-weights"],
			requiredOutputs: [crosswalkWeights],
		},
	),
	// Converts figures whose answer is published elsewhere and measures the
	// error, which is what the bounds of every converted value come from.
	stage(
		"conversion-backtest",
		["atlas-sqlite", "crosswalk-weights"],
		["pipeline/src/stages/build-conversion-backtest.ts"],
		{
			dependencyOutputs: {
				"atlas-sqlite": [atlasBase],
				"crosswalk-weights": [crosswalkWeights],
			},
			rawInputs: [],
			writes: ["data/build/conversion-backtest"],
			outputs: ["data/build/conversion-backtest"],
			requiredOutputs: [
				conversionBacktest,
				"data/build/conversion-backtest/backtest-tables.md",
			],
		},
	),
	// Moves published series onto the latest releases under the rules the
	// backtest supports. Every value is marked as converted.
	stage(
		"converted-series",
		["atlas-sqlite", "crosswalk-weights", "conversion-backtest"],
		["pipeline/src/stages/build-converted-series.ts"],
		{
			dependencyOutputs: {
				"atlas-sqlite": [atlasBase],
				"crosswalk-weights": [crosswalkWeights],
				"conversion-backtest": [conversionBacktest],
			},
			memoryMb: 2240,
			rawInputs: [],
			writes: ["data/build/converted-series"],
			outputs: ["data/build/converted-series"],
			requiredOutputs: [
				convertedSeries,
				"data/build/converted-series/converted-series.md",
			],
		},
	),
	// Notional 2019 general election results on the 2024 constituencies,
	// shipped as modelled series. The Scottish council first preferences are
	// read from their source file, see pipeline/src/notional/scotland.ts.
	stage(
		"notional-elections",
		["atlas-sqlite", "crosswalk-weights", "weight-atoms"],
		["pipeline/src/stages/build-notional-elections.ts"],
		{
			memoryMb: 2304,
			rawInputs: [
				"data/source/politics/local-elections/local-election/2017/leap-2017-05-04.csv",
			],
			writes: ["data/build/notional-elections"],
			outputs: ["data/build/notional-elections"],
			requiredOutputs: [
				"data/build/notional-elections/notional-elections.sqlite",
			],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"assemble-atlas",
		[
			"atlas-sqlite",
			"geometry-store",
			"statistics-read-path",
			"data-catalog",
			"geography-catalogues",
			"postcode-index",
			"postcode-areas",
			"crosswalk-weights",
			"converted-series",
			"notional-elections",
		],
		["pipeline/src/stages/assemble-atlas.ts"],
		{
			dependencyOutputs: {
				"atlas-sqlite": [atlasBase, atlasBaseMetadata],
				"crosswalk-weights": [crosswalkWeights],
				"converted-series": [convertedSeries],
			},
			memoryMb: 2880,
			writes: [
				"data/build/atlas.sqlite",
				"data/build/atlas-build.sqlite",
			],
			rawInputs: crosswalkWeightInputs,
			requiredOutputs: [
				"data/build/atlas.sqlite",
				"data/build/atlas-build.sqlite",
			],
			// A worker is started by path, not imported, so it is listed here.
			codeInputs: [
				"pipeline/package.json",
				"pipeline/tsconfig.json",
				"pipeline/src/storage/areaLocationWorker.ts",
			],
		},
	),
	// Splits atlas.sqlite into core and per-module SQLite and Parquet. The
	// website and the API keep reading atlas.sqlite, which it does not change.
	stage(
		"build-modules",
		["assemble-atlas"],
		["pipeline/src/stages/build-modules.ts"],
		{
			rawInputs: [],
			writes: ["data/build/modules"],
			outputs: ["data/build/modules"],
			requiredOutputs: ["data/build/modules/build.json"],
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
			memoryMb: 2496,
			rawInputs: [],
			writes: [`${artifacts}/measure-compatibility.json`],
		},
	),
	stage(
		"statistics-read-path",
		["atlas-sqlite", "data-catalog", "statistics-vocabulary"],
		["pipeline/src/stages/build-statistics-read-path.ts"],
		{
			dependencyOutputs: { "atlas-sqlite": [atlasBase] },
			writes: ["data/build/statistics-read-path.json"],
			rawInputs: [],
			requiredOutputs: ["data/build/statistics-read-path.json"],
		},
	),
	stage(
		"export-manifest",
		["data-catalog", "atlas-sqlite", "statistics-read-path"],
		["pipeline/src/stages/build-export-manifest.ts"],
		{
			dependencyOutputs: { "atlas-sqlite": [atlasBase] },
			memoryMb: 2048,
			compact: {
				variable: "DATA_EXPORT_JOBS",
				workers: 1,
				normalWorkers: 2,
				normalBudgetMb: 5120,
				memoryMb: 1280,
			},
			outputs: [`${artifacts}/exports`],
			requiredOutputs: [`${artifacts}/export-manifest.json`],
			rawInputs: [],
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
			memoryMb: 2496,
			writes: ["data/build/postcode-areas-component"],
			rawInputs: [],
			outputs: ["data/build/postcode-areas-component"],
			requiredOutputs: [
				"data/build/postcode-areas-component/manifest.json",
			],
		},
	),
	// Its tables are the postcode-counts component of the atlas cache, in a file
	// that only this stage writes. `assemble-cache` copies it into the cache.
	stage(
		"postcode-counts",
		["postcode-index", "assemble-atlas"],
		["pipeline/src/stages/build-postcode-counts.ts"],
		{
			rawInputs: [],
			writes: [cachePart("postcode-counts")],
			requiredOutputs: [cachePart("postcode-counts")],
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
		{},
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
			memoryMb: 1536,
			rawInputs: crosswalkWeightInputs,
			writes: ["data/build/weight-atoms"],
			outputs: ["data/build/weight-atoms"],
			requiredOutputs: ["data/build/weight-atoms/atoms.json"],
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
			memoryMb: 1344,
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
			dependencyOutputs: { "atlas-sqlite": [atlasBase] },
			rawInputs: [],
			writes: [`${geography}/relationship-paths.json`],
		},
	),
	stage(
		"analysis-geographies",
		["data-catalog", "crosswalk-inventory", "relationship-paths"],
		["pipeline/src/stages/build-analysis-geographies.ts"],
		{
			rawInputs: [],
			writes: [`${geography}/analysis-geographies.json`],
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
			memoryMb: 1536,
			rawInputs: [],
			writes: [`${geography}/analysis-geography-validation.json`],
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
		},
	),
	stage(
		"location-projections",
		["named-locations", "crosswalk-inventory", "area-inventory"],
		["pipeline/src/stages/build-location-projections.ts"],
		{
			memoryMb: 1920,
			rawInputs: [],
			writes: ["data/build/location-projections"],
		},
	),
	stage(
		"relationship-candidates",
		["area-inventory", "crosswalk-inventory"],
		["pipeline/src/stages/build-relationship-candidates.ts"],
		{
			memoryMb: 1856,
			rawInputs: areaInventoryInputs,
			writes: [`${artifacts}/relationship-candidates.json`],
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
		},
	),
	stage(
		"lookup-manifest",
		["area-inventory", "crosswalk-inventory", "named-locations"],
		["pipeline/src/stages/build-lookup-manifest.ts"],
		{
			memoryMb: 1536,
			rawInputs: [],
			writes: [`${artifacts}/lookup-manifest.json`],
		},
	),
	stage(
		"map-resource",
		["boundary-registry", "area-inventory", "geometry-store"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-map-resource.ts",
		],
		{
			memoryMb: 8192,
			// A cached build plans in 420 MB and reuses every release.
			trial: { memoryMb: 800 },
			compact: {
				memoryMb: 5120,
				variable: "ATLAS_MAP_RESOURCE_JOBS",
				workers: 1,
				normalWorkers: 2,
				memoryVariable: "ATLAS_MAP_RESOURCE_MEMORY_MB",
				normalBudgetMb: 8192,
			},
			writes: [
				"data/build/map-resources",
				`${artifacts}/map-resources.json`,
			],
			outputs: ["data/build/map-resources"],
			rawInputs: [],
			// A worker is started by path, not imported, so what it imports
			// beyond the stage's own imports is listed here.
			codeInputs: [
				"packages/geometry/src/tiles/node/mapResource",
				"pipeline/src/atlas/flatDownloads.ts",
				"pipeline/src/maps/compileMapResource.ts",
				"pipeline/src/maps/mapResourcePool.ts",
				"pipeline/src/maps/mapResourceWorker.ts",
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
			memoryMb: 2752,
			rawInputs: [],
			writes: [`${artifacts}/validation-report.json`],
		},
	),
	// Reads every catalogue the build has written so far, and so waits for them.
	// The release lists its documents, so it is written after them.
	stage(
		"documents",
		[
			"atlas-sqlite",
			"operations",
			"geometry-store",
			"geography-catalogues",
			"boundary-registry",
			"derived-boundaries",
			"area-inventory",
			"named-locations",
			"place-index",
			"area-search-index",
			"postcode-index",
			"postcode-areas",
			"postcode-counts",
			"assemble-cache",
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
		[
			"--max-old-space-size=3072",
			// The stage allocates short-lived rows for every measure; a larger
			// young generation spends far less of its time collecting them.
			"--max-semi-space-size=128",
			"pipeline/src/stages/build-evidence-documents.ts",
		],
		{
			memoryMb: 3712,
			writes: [
				`${artifacts}/documents`,
				`${artifacts}/evidence-documents.json`,
			],
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
			memoryMb: 1536,
			writes: [
				`${atlasAssets}/atlas-lookups`,
				`${atlasAssets}/atlas-lookups.json`,
			],
			rawInputs: [],
			outputs: ["data/build/atlas-assets/atlas-lookups"],
			requiredOutputs: ["data/build/atlas-assets/atlas-lookups.json"],
		},
	),
	// The only writer of the atlas cache: it copies the part of every stage
	// that built a component into one file, stamped with the hash of
	// `atlas.sqlite` it was built for.
	stage(
		"assemble-cache",
		[
			"atlas-sqlite",
			"assemble-atlas",
			"place-index",
			"area-search-index",
			"postcode-counts",
		],
		["pipeline/src/stages/assemble-cache.ts"],
		{
			dependencyOutputs: { "atlas-sqlite": atlasBaseCacheParts },
			writes: [atlasCache],
			rawInputs: [],
			requiredOutputs: [atlasCache],
		},
	),
	stage(
		"atlas-release",
		["documents", "atlas-lookups", "assemble-atlas", "assemble-cache"],
		["pipeline/src/stages/build-atlas-release.ts"],
		{
			rawInputs: [],
			writes: [`${artifacts}/atlas-release.json`],
		},
	),
	// Place pages read areas, crosswalks, geometry and named locations, and
	// their charted series the assembled atlas's converted series; the docs
	// catalogue reads the API's catalogue and map resource manifests.
	stage(
		"atlas-pages",
		[
			"geography-catalogues",
			"atlas-sqlite",
			"assemble-atlas",
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
			memoryMb: 3648,
			writes: [
				`${atlasAssets}/atlas-pages`,
				`${atlasAssets}/atlas-pages.json`,
			],
			rawInputs: boundaryOffsetInputs,
			outputs: ["data/build/atlas-assets/atlas-pages"],
			requiredOutputs: ["data/build/atlas-assets/atlas-pages.json"],
		},
	),
];
