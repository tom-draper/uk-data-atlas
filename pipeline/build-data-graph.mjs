import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { sourcesMatchRelease } from "../scripts/data-release.mjs";
import { ATLAS_CACHE_WORK } from "./src/storage/atlasCacheWork.ts";
import { CACHE_STAGES, STAMP_DIRECTORY } from "./src/storage/stageStamp.ts";
import { PLACE_LOOKUPS } from "../packages/datasets/src/data/gazetteer/places.ts";
import {
	BOUNDARY_CATALOG,
	propertiesAsset,
} from "../packages/datasets/src/data/boundaries/catalog.ts";

const sheetInputs = new Set([
	"xlsxSheet",
	"xlsxSheetRows",
	"xlsxSheetSelectedRows",
	"xlsSheet",
	"xlsSheetRows",
	"odsTableRows",
]);
const fileInputs = new Set([
	"text",
	"csvRows",
	"zipCsv",
	"zipCsvRows",
	"odsContent",
]);

const datasetInputs = (root) => {
	try {
		const manifest = JSON.parse(
			readFileSync(
				join(root, "data/build/datasets/dataset-manifest.json"),
				"utf8",
			),
		);
		if (!Array.isArray(manifest.datasets) || manifest.datasets.length === 0)
			return [""];
		const inputs = [];
		const add = (path) => {
			if (
				typeof path !== "string" ||
				!path ||
				isAbsolute(path) ||
				path.split(/[\\/]/).includes("..")
			)
				throw new Error("Invalid dataset input");
			inputs.push(path);
		};
		for (const dataset of manifest.datasets) {
			if (
				dataset.inputTrackingVersion !== 1 ||
				!Array.isArray(dataset.inputs)
			)
				return [""];
			if (dataset.missingSource !== undefined) add(dataset.missingSource);
			for (const input of dataset.inputs) {
				if (typeof input.path !== "string") return [""];
				if (sheetInputs.has(input.kind)) {
					const separator = input.path.lastIndexOf("#");
					if (separator < 1) return [""];
					add(input.path.slice(0, separator));
				} else if (fileInputs.has(input.kind)) add(input.path);
				else return [""];
			}
		}
		return inputs;
	} catch {
		return [""];
	}
};

const crosswalkInputs = (root) => {
	const { crosswalks } = JSON.parse(
		readFileSync(
			join(root, "services/api/config/crosswalk-adapters.json"),
			"utf8",
		),
	);
	return [
		...geometryStoreInputs(root),
		...crosswalks.flatMap((adapter) =>
			[adapter.input, adapter.population?.input].filter(
				(input) => typeof input === "string",
			),
		),
	];
};

const sourceMetadataInputs = (root, base = "") => {
	const source = join(root, "data/source");
	const metadata = (directory) => {
		let entries;
		try {
			entries = readdirSync(join(source, directory), {
				withFileTypes: true,
			});
		} catch (error) {
			if (error?.code === "ENOENT") return [];
			throw error;
		}
		return entries.flatMap((entry) => {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) return metadata(path);
			return entry.name === "meta.json" ? [path] : [];
		});
	};
	return metadata(base);
};

const boundaryRegistryInputs = (root) =>
	sourceMetadataInputs(root, "boundaries").filter((path) => {
		const parts = path.split(/[\\/]/);
		return parts.length === 4 && parts[0] === "boundaries";
	});

const safeRelativePath = (path) =>
	typeof path === "string" &&
	path.length > 0 &&
	!isAbsolute(path) &&
	!path.split(/[\\/]/).includes("..");

const boundarySourceInputs = (root, metadata, extensions) =>
	metadata.flatMap((metaPath) => {
		const inputs = [metaPath];
		if (!existsSync(join(root, "data/source", metaPath))) return inputs;
		const value = JSON.parse(
			readFileSync(join(root, "data/source", metaPath), "utf8"),
		);
		if (!Array.isArray(value.files))
			throw new Error("Invalid boundary metadata");
		for (const [extension, replacement] of extensions) {
			const file = value.files.find(
				(candidate) =>
					candidate?.role === "source" &&
					typeof candidate.path === "string" &&
					candidate.path.toLowerCase().endsWith(extension),
			);
			if (!file) continue;
			if (!safeRelativePath(file.path))
				throw new Error("Invalid boundary source path");
			const path = replacement
				? file.path.replace(/\.shp$/i, replacement)
				: file.path;
			inputs.push(join(dirname(metaPath), path));
		}
		return inputs;
	});

const derivedBoundaryInputs = (root) => {
	try {
		const config = JSON.parse(
			readFileSync(
				join(root, "services/api/config/area-source-adapters.json"),
				"utf8",
			),
		);
		if (
			!config.releases ||
			typeof config.releases !== "object" ||
			Array.isArray(config.releases)
		)
			throw new Error("Invalid adapters");
		const metadata = Object.values(config.releases).map((adapter) => {
			const geography = adapter?.source?.geography;
			const release = adapter?.source?.boundaryRelease;
			if (
				!safeRelativePath(geography) ||
				!safeRelativePath(release) ||
				/[\\/]/.test(geography) ||
				/[\\/]/.test(release)
			)
				throw new Error("Invalid boundary release");
			return join(
				"boundaries",
				geography
					.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2")
					.toLowerCase(),
				release,
				"meta.json",
			);
		});
		return boundarySourceInputs(root, metadata, [[".geojson", null]]);
	} catch {
		return ["boundaries"];
	}
};

const areaInventoryInputs = (root) => {
	try {
		return boundarySourceInputs(root, boundaryRegistryInputs(root), [
			[".geojson", null],
			[".shp", ".dbf"],
		]);
	} catch {
		return ["boundaries"];
	}
};

const geometrySourceRegistryInputs = (root) => {
	try {
		return boundaryRegistryInputs(root).flatMap((metaPath) => {
			const metadata = JSON.parse(
				readFileSync(join(root, "data/source", metaPath), "utf8"),
			);
			if (!Array.isArray(metadata.files))
				throw new Error("Invalid boundary metadata");
			const source = metadata.files.find(
				(file) =>
					file?.role === "source" &&
					typeof file.path === "string" &&
					/\.(geojson|shp)$/i.test(file.path),
			);
			if (!source) return [metaPath];
			if (!safeRelativePath(source.path))
				throw new Error("Invalid boundary source path");
			const path = join(dirname(metaPath), source.path);
			return /\.shp$/i.test(path)
				? [metaPath, path, path.replace(/\.shp$/i, ".prj")]
				: [metaPath, path];
		});
	} catch {
		return ["boundaries"];
	}
};

const geometryStoreInputs = (root) => {
	try {
		const registry = JSON.parse(
			readFileSync(
				join(root, "data/build/artifacts/geometry-sources.json"),
				"utf8",
			),
		);
		if (registry.schemaVersion !== 1 || !Array.isArray(registry.releases))
			throw new Error("Invalid geometry source registry");
		const inputs = registry.releases.flatMap((release) => {
			if (release?.status !== "available") return [];
			if (
				!safeRelativePath(release.input) ||
				!release.input.startsWith("boundaries/")
			)
				throw new Error("Invalid geometry input");
			return /\.shp$/i.test(release.input)
				? [release.input, release.input.replace(/\.shp$/i, ".dbf")]
				: [release.input];
		});
		const offsets = readdirSync(join(root, "data/source/boundaries"), {
			withFileTypes: true,
		})
			.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
			.map((entry) => join("boundaries", entry.name));
		return [...inputs, ...offsets];
	} catch {
		return ["boundaries"];
	}
};

const websiteBoundaryInputs = (root) => {
	try {
		const metadata = boundaryRegistryInputs(root);
		const inputs = metadata.flatMap((metaPath) => {
			const meta = JSON.parse(
				readFileSync(join(root, "data/source", metaPath), "utf8"),
			);
			if (!Array.isArray(meta.files))
				throw new Error("Invalid boundary metadata");
			const sources = meta.files.filter(
				(file) =>
					(file?.role === "source" || file?.role === "derived") &&
					typeof file.path === "string" &&
					file.path.endsWith(".geojson"),
			);
			return [
				metaPath,
				join(dirname(metaPath), "boundaries.topojson"),
				...sources.map((file) => {
					if (!safeRelativePath(file.path))
						throw new Error("Invalid boundary source path");
					return join(dirname(metaPath), file.path);
				}),
			];
		});
		const offsets = readdirSync(join(root, "data/source/boundaries"), {
			withFileTypes: true,
		})
			.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
			.map((entry) => join("boundaries", entry.name));
		return [...inputs, ...offsets];
	} catch {
		return ["boundaries"];
	}
};

const boundaryOffsetInputs = (root) => {
	try {
		return readdirSync(join(root, "data/source/boundaries"), {
			withFileTypes: true,
		})
			.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
			.map((entry) => join("boundaries", entry.name));
	} catch {
		return ["boundaries"];
	}
};

const countyShapeInputs = [
	"geography/ceremonial-counties/source/Boundary-line-ceremonial-counties_region.shp",
	"geography/ceremonial-counties/source/Boundary-line-ceremonial-counties_region.dbf",
	"geography/historic-counties/source/Boundary-line-historic-counties_region.shp",
	"geography/historic-counties/source/Boundary-line-historic-counties_region.dbf",
];

const gazetteerLookupInputs = PLACE_LOOKUPS.map(({ lookup, file }) =>
	join("lookups", lookup, file),
);

const apiDatasetInputs = (root) => [
	...websiteBoundaryInputs(root),
	...gazetteerLookupInputs,
];

const websiteFallbackBoundaryInputs = Object.values(BOUNDARY_CATALOG).flatMap(
	({ vintages }) =>
		Object.values(vintages).flatMap((asset) => {
			const topology = asset
				.split("?")[0]
				.replace(/^\/data\//, "")
				.replace(/\.pmtiles$/, ".topojson");
			const properties = propertiesAsset(asset)
				.split("?")[0]
				.replace(/^\/data\//, "");
			return [topology, properties];
		}),
);

const censusSmallAreaInputs = (root) => {
	const prefix = "demographics/census-2021-small-area";
	try {
		return readdirSync(join(root, "data/source", prefix), {
			withFileTypes: true,
		})
			.filter((entry) => entry.isDirectory())
			.flatMap(({ name }) => [
				join(prefix, name, "meta.json"),
				join(prefix, name, `census2021-${name}-lsoa.csv`),
				join(prefix, name, `census2021-${name}-msoa.csv`),
			]);
	} catch {
		return [prefix];
	}
};

// The files `weight-atoms` and `crosswalk-weights` share between postcodes: counts of residents,
// households and dwellings, the centroids of output areas with no postcode, and
// each postcode's output area. pipeline/src/crosswalk-weights/atoms.ts and
// build-crosswalk-weights.ts read these.
const crosswalkWeightInputs = (root) => {
	const onspd = join(root, "data/source/postcodes/onspd");
	let edition;
	try {
		edition = readdirSync(onspd)
			.filter((name) => existsSync(join(onspd, name, "meta.json")))
			.sort()
			.at(-1);
	} catch {
		edition = undefined;
	}
	return [
		"demographics/census-2021-small-area/ts001/census2021-ts001-oa.csv",
		"demographics/census-2021-small-area/ts003/census2021-ts003-oa.csv",
		"demographics/population/census-2022-scotland-output-area/outputarea2022_usualresidentpopulation.csv",
		"demographics/population/census-2022-scotland-output-area/census_2022_UV406_Household_size_OA.csv",
		"lookups/output-area-to-lsoa/2021-12-ew/OA_LSOA_MSOA_EW_DEC_2021_LU_v3.geojson",
		"geography/population-weighted-centroids/oa-2021-ew-v4/oa-2021-ew-pwc.csv",
		"geography/population-weighted-centroids/oa-2022-sc/oa-2022-sc-pwc.csv",
		"housing/council-tax-stock/2026/CTSOP1_1_2026_03_31.csv",
		...(edition
			? [
					`postcodes/onspd/${edition}/meta.json`,
					`postcodes/onspd/${edition}/onspd-permitted.csv.gz`,
					`postcodes/onspd/${edition}/onspd-output-areas.csv.gz`,
				]
			: ["postcodes/onspd"]),
	];
};

const postcodeInputs = (root) => {
	const prefix = "postcodes/onspd";
	const directory = join(root, "data/source", prefix);
	try {
		const edition = readdirSync(directory)
			.filter((name) => existsSync(join(directory, name, "meta.json")))
			.sort()
			.at(-1);
		if (!edition) return [prefix];
		const metaPath = join(prefix, edition, "meta.json");
		const meta = JSON.parse(
			readFileSync(join(root, "data/source", metaPath), "utf8"),
		);
		const source = meta.files?.find((file) => file.role === "source")?.path;
		if (
			typeof source !== "string" ||
			!source ||
			isAbsolute(source) ||
			source.split(/[\\/]/).includes("..")
		)
			return [prefix];
		return [metaPath, join(prefix, edition, source)];
	} catch {
		return [prefix];
	}
};

const websiteDatasetInputs = (root) => {
	const metadata = sourceMetadataInputs(root).filter((path) => {
		const parts = path.split(/[\\/]/);
		return (
			parts.length > 1 &&
			parts
				.slice(0, -1)
				.every(
					(part) => part !== "node_modules" && !part.startsWith("."),
				)
		);
	});
	try {
		const presence = metadata.flatMap((path) => {
			const value = JSON.parse(
				readFileSync(join(root, "data/source", path), "utf8"),
			);
			if (!Array.isArray(value.files))
				throw new Error("Invalid source metadata");
			return value.files.map((file) => {
				if (
					typeof file.path !== "string" ||
					!file.path ||
					isAbsolute(file.path) ||
					file.path.split(/[\\/]/).includes("..")
				)
					throw new Error("Invalid source path");
				return join(dirname(path), file.path);
			});
		});
		return {
			paths: [
				...metadata,
				...websiteFallbackBoundaryInputs,
				...gazetteerLookupInputs,
				"transport/road-safety/dft-road-casualty-statistics-collision-provisional-2025.csv",
			],
			presence,
		};
	} catch {
		return { paths: [""], presence: [] };
	}
};

const stage = (
	name,
	dependencies = [],
	args = [`scripts/build-${name}.ts`],
	{
		cacheable = true,
		check = false,
		exclusive = false,
		isCurrent,
		outputs = [],
		requiredOutputs = [],
		codeInputs = [],
		rawInputs,
		shared = [],
		scratch = [],
		finishedBy,
		writes = [],
	} = {},
) => ({
	name,
	dependencies,
	args,
	cacheable,
	check,
	exclusive,
	isCurrent,
	outputs,
	requiredOutputs,
	codeInputs,
	rawInputs,
	shared,
	scratch,
	finishedBy,
	writes,
});

// Checked-in files the registry stages generate. Other stages import them.
const catalogueRegistry = "packages/datasets/src/data/catalog";
const catalogueFiles = [
	`${catalogueRegistry}/definitions/index.ts`,
	`${catalogueRegistry}/registry.ts`,
	`${catalogueRegistry}/generated.ts`,
	"packages/datasets/src/data/declarations.ts",
];
const chartRegistryFiles = [
	"lib/datasets/generated.ts",
	"lib/datasets/generatedCharts.tsx",
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
const stampOf = (stage) => `${STAMP_DIRECTORY}/${stage}.json`;

/**
 * A check stage: an exact-copy (parity) check kept apart from the stage that
 * writes the output it checks, so that stage writes once and computes no
 * second copy. It reads outputs, writes only a stamp, and nothing depends on
 * it. A local build leaves it out; `--verify`, `DATA_BUILD_VERIFY=1`, CI and
 * `pnpm data:verify` run it. Like any stage it is keyed on its code and its
 * dependencies' output digests, so once it has passed it is skipped until
 * one of those changes. The script is `pipeline/src/stages/<name>.ts`.
 */
const checkStage = (name, dependencies, options = {}) =>
	stage(name, dependencies, [`pipeline/src/stages/${name}.ts`], {
		rawInputs: [],
		requiredOutputs: [stampOf(name)],
		...options,
		check: true,
	});

const artifacts = "data/build/artifacts";
const atlasAssets = "data/build/atlas-assets";
const geography = "data/build/geography";

// Declare paths changed beyond outputs and requiredOutputs. Stages sharing a
// path do not run together; stages without declared paths run alone.
const apiStages = [
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
			"pipeline/src/stages/compile-datasets.mts",
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
	checkStage("verify-dataset-payloads", ["datasets", "atlas-sqlite"], {
		codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
	}),
	stage(
		"api-datasets",
		["sources"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/stages/build-api-datasets.mts",
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
	stage(
		"assemble-atlas",
		[
			"atlas-sqlite",
			"data-catalog",
			"geography-catalogues",
			"postcode-index",
			"postcode-areas",
			"crosswalk-weights",
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

const websiteStages = [
	stage(
		"boundaries",
		["sources"],
		["pipeline/src/stages/compile-boundaries.mts"],
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
			"pipeline/src/stages/compile-boundary-tiles.mts",
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
			"pipeline/src/stages/compile-website-data.mts",
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
				"pipeline/src/stages/compile-boundaries.mts",
				"pipeline/src/geographies/boundaryReleaseSources.ts",
				"pipeline/src/geographies/boundaryBuildFiles.ts",
				"pipeline/src/geographies/correctBoundarySource.ts",
				"packages/geography/src/reverseGridOffset.ts",
				"packages/atlas-db/src/buildTiming.ts",
				"pipeline/src/stages/compile-boundary-tiles.mts",
				"scripts/generate-dataset-registry.ts",
			],
		},
	),
	// The arrays the map colours areas from. They read the compiled datasets and
	// the boundary sidecars, and nothing reads them back, so they run alone.
	stage(
		"website-map-values",
		["website-datasets"],
		["--import", "tsx", "pipeline/src/stages/build-map-values.mts"],
		{
			writes: ["public/data/map-values"],
			outputs: ["public/data/map-values"],
			rawInputs: [],
			codeInputs: [
				"package.json",
				"packages/datasets",
				"packages/map-tiles",
				"pipeline/src/precompile/paths.mts",
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

export const buildDataStages = [...apiStages, ...websiteStages];
