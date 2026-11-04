import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
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

const defaultRawInputs = {
	operations: [],
	datasets: datasetInputs,
	"terrain-catalogue": [],
	"atlas-sqlite": censusSmallAreaInputs,
	"api-datasets": apiDatasetInputs,
	"boundary-registry": boundaryRegistryInputs,
	"derived-boundaries": derivedBoundaryInputs,
	"area-inventory": areaInventoryInputs,
	"geometry-source-registry": geometrySourceRegistryInputs,
	"geometry-store": geometryStoreInputs,
	"named-locations": [
		"geography/ceremonial-counties/source/Boundary-line-ceremonial-counties_region.shp",
		"geography/ceremonial-counties/source/Boundary-line-ceremonial-counties_region.dbf",
		"geography/historic-counties/source/Boundary-line-historic-counties_region.shp",
		"geography/historic-counties/source/Boundary-line-historic-counties_region.dbf",
	],
	"postcode-index": postcodeInputs,
	"statistics-vocabulary": [],
	"data-catalog": censusSmallAreaInputs,
	"assemble-atlas": [],
	"measure-compatibility": [],
	"statistics-read-path": [],
	"export-manifest": [],
	"postcode-areas": [],
	"crosswalk-inventory": crosswalkInputs,
	"relationship-paths": [],
	"analysis-geographies": [],
	"analysis-geography-validation": [],
	"geography-catalogues": [],
	"location-projections": [],
	"relationship-candidates": areaInventoryInputs,
	"geography-inventory": sourceMetadataInputs,
	"lookup-manifest": [],
	"map-resource": geometryStoreInputs,
	"validation-report": [],
	"atlas-release-initial": [],
	documents: boundaryOffsetInputs,
	"atlas-lookups": [],
	"atlas-release": [],
	"atlas-pages": boundaryOffsetInputs,
	boundaries: websiteBoundaryInputs,
	"boundary-tiles": websiteBoundaryInputs,
	"website-tiles": [],
	"website-lookups": [],
	"website-datasets": websiteDatasetInputs,
};

const stage = (
	name,
	dependencies = [],
	args = [`scripts/build-${name}.ts`],
	{
		cacheable = true,
		outputs = [],
		requiredOutputs = [],
		codeInputs = [],
		rawInputs,
	} = {},
) => ({
	name,
	dependencies,
	args,
	cacheable,
	outputs,
	requiredOutputs,
	codeInputs,
	rawInputs: rawInputs ?? defaultRawInputs[name],
});

const apiStages = [
	// Always runs. It is quick when data/ already matches the pinned release.
	stage("sources", [], ["data:download"], {
		cacheable: false,
	}),
	stage("operations", [], ["pipeline/src/build-operations.ts"], {
		codeInputs: [
			"services/api/openapi.yaml",
			"pipeline/package.json",
			"pipeline/tsconfig.json",
		],
	}),
	stage(
		"catalogue-registry",
		["sources"],
		["pipeline/src/build-catalogue-registry.ts"],
		{ cacheable: false },
	),
	// Compiled once into data/build/datasets, for the website and the API.
	stage(
		"datasets",
		["catalogue-registry"],
		["--max-old-space-size=3072", "pipeline/src/compile-datasets.mts"],
		{
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
		["pipeline/src/build-terrain-catalogue.ts"],
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
		["pipeline/src/build-atlas-sqlite.ts"],
		{
			rawInputs: censusSmallAreaInputs,
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
		["--max-old-space-size=3072", "pipeline/src/build-api-datasets.mts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"boundary-registry",
		["sources"],
		["pipeline/src/build-boundary-registry.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"derived-boundaries",
		["sources"],
		["pipeline/src/build-derived-boundaries.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"area-inventory",
		["boundary-registry", "derived-boundaries"],
		["pipeline/src/build-area-inventory.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"geometry-source-registry",
		["area-inventory"],
		["pipeline/src/build-geometry-source-registry.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"geometry-store",
		["geometry-source-registry"],
		["--max-old-space-size=3072", "pipeline/src/build-geometry-store.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"named-locations",
		["area-inventory", "geometry-store", "api-datasets"],
		["pipeline/src/build-named-locations.ts"],
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
		["pipeline/src/build-place-index.ts"],
		{
			cacheable: false,
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"area-search-index",
		["assemble-atlas"],
		["pipeline/src/build-area-search-index.ts"],
		{
			cacheable: false,
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"postcode-index",
		["sources"],
		["pipeline/src/build-postcode-index.ts"],
		{
			requiredOutputs: ["data/build/postcode-index.sqlite"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			rawInputs: postcodeInputs,
		},
	),
	stage(
		"statistics-vocabulary",
		["atlas-sqlite"],
		["pipeline/src/build-statistics-vocabulary.ts"],
		{
			rawInputs: [],
			requiredOutputs: ["data/build/statistics-vocabulary.json"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"data-catalog",
		["datasets", "statistics-vocabulary"],
		["pipeline/src/build-data-catalog.ts"],
		{
			rawInputs: censusSmallAreaInputs,
			requiredOutputs: [
				"data/build/compiled-observations",
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
		["pipeline/src/assemble-atlas.ts"],
		{
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
		["pipeline/src/build-measure-compatibility.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"statistics-read-path",
		["atlas-sqlite", "data-catalog", "statistics-vocabulary"],
		["pipeline/src/build-statistics-read-path.ts"],
		{
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
		["pipeline/src/build-export-manifest.ts"],
		{
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
		["--max-old-space-size=3072", "pipeline/src/build-postcode-areas.ts"],
		{
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
		["pipeline/src/build-postcode-counts.ts"],
		{ cacheable: false },
	),
	stage(
		"crosswalk-inventory",
		["area-inventory", "geometry-source-registry"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/build-crosswalk-inventory.ts",
		],
		{
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
		["crosswalk-inventory"],
		["pipeline/src/build-relationship-paths.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"analysis-geographies",
		["data-catalog", "crosswalk-inventory", "relationship-paths"],
		["pipeline/src/build-analysis-geographies.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"analysis-geography-validation",
		[
			"analysis-geographies",
			"data-catalog",
			"crosswalk-inventory",
			"statistics-read-path",
		],
		["pipeline/src/build-analysis-geography-validation.ts"],
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
		["pipeline/src/build-geography-catalogues.ts"],
		{
			rawInputs: [],
			requiredOutputs: ["data/build/geography-payloads.json"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"location-projections",
		["named-locations", "crosswalk-inventory", "area-inventory"],
		["pipeline/src/build-location-projections.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"relationship-candidates",
		["area-inventory", "crosswalk-inventory"],
		["pipeline/src/build-relationship-candidates.ts"],
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
		["pipeline/src/build-geography-inventory.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"lookup-manifest",
		["area-inventory", "crosswalk-inventory", "named-locations"],
		["pipeline/src/build-lookup-manifest.ts"],
		{ codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"] },
	),
	stage(
		"map-resource",
		["boundary-registry", "area-inventory", "geometry-source-registry"],
		["--max-old-space-size=3072", "pipeline/src/build-map-resource.ts"],
		{
			outputs: ["data/build/map-resources"],
			rawInputs: geometryStoreInputs,
			codeInputs: [
				"packages/atlas-runtime/src/maps/mapResource",
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
		["pipeline/src/build-validation-report.ts"],
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
		["pipeline/src/build-atlas-release.ts"],
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
			"--max-old-space-size=3072",
			"pipeline/src/build-evidence-documents.ts",
		],
		{
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
		["--max-old-space-size=3072", "pipeline/src/build-atlas-lookups.ts"],
		{
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
		["pipeline/src/stamp-atlas-cache.ts"],
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
		["pipeline/src/build-atlas-release.ts"],
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
		["--max-old-space-size=3072", "pipeline/src/build-atlas-pages.ts"],
		{
			rawInputs: boundaryOffsetInputs,
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
			outputs: ["data/build/atlas-assets/atlas-pages"],
			requiredOutputs: ["data/build/atlas-assets/atlas-pages.json"],
		},
	),
];

const websiteStages = [
	stage("boundaries", ["sources"], ["pipeline/src/compile-boundaries.mts"], {
		outputs: ["data/build/website-boundaries"],
		codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
	}),
	stage(
		"boundary-tiles",
		["boundaries"],
		[
			"--max-old-space-size=3072",
			"pipeline/src/compile-boundary-tiles.mts",
		],
		{
			outputs: ["data/build/boundaries"],
			rawInputs: websiteBoundaryInputs,
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	// Publishes the map resources and properties for the website to serve.
	stage(
		"website-tiles",
		["boundary-tiles"],
		["scripts/link-boundary-tiles.ts"],
		{
			outputs: ["public/data/boundaries"],
			rawInputs: [],
			codeInputs: [
				"packages/atlas-runtime/src/areas/boundaryResources.ts",
			],
		},
	),
	stage(
		"website-lookups",
		["atlas-lookups", "atlas-pages"],
		["pipeline/src/build-atlas-assets.ts"],
		{
			rawInputs: [],
			requiredOutputs: ["data/build/website-assets.sqlite"],
			codeInputs: ["pipeline/package.json", "pipeline/tsconfig.json"],
		},
	),
	stage(
		"website-datasets",
		["atlas-sqlite", "assemble-atlas", "website-tiles"],
		["--max-old-space-size=3072", "pipeline/src/compile-website-data.mts"],
		{
			outputs: ["public/data/datasets"],
			rawInputs: websiteDatasetInputs,
			codeInputs: [
				"package.json",
				"packages/geography",
				"packages/map-tiles",
				"pipeline/src/precompile",
				"pipeline/src/compile-boundaries.mts",
				"pipeline/src/geographies/boundaryReleaseSources.ts",
				"pipeline/src/geographies/boundaryBuildFiles.ts",
				"pipeline/src/geographies/correctBoundarySource.ts",
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
		["scripts/generate-dataset-registry.ts"],
		{ cacheable: false },
	),
];

export const buildDataStages = [...apiStages, ...websiteStages];
