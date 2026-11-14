import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import {
	isStagedPath,
	SOURCES,
	sourceDir,
	sourceInput,
} from "../packages/datasets/src/declaration/sources.ts";
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
			[adapter.input, adapter.population?.input]
				.filter((input) => typeof input === "string")
				.map(sourceInput),
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
			// Staged sources are not built, so they must not change a stage's key.
			if (entry.isDirectory())
				return isStagedPath(path) ? [] : metadata(path);
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

export const countyShapeInputs = [
	sourceDir(
		"ceremonial-counties",
		"source/Boundary-line-ceremonial-counties_region.shp",
	),
	sourceDir(
		"ceremonial-counties",
		"source/Boundary-line-ceremonial-counties_region.dbf",
	),
	sourceDir(
		"historic-counties",
		"source/Boundary-line-historic-counties_region.shp",
	),
	sourceDir(
		"historic-counties",
		"source/Boundary-line-historic-counties_region.dbf",
	),
];

const gazetteerLookupInputs = PLACE_LOOKUPS.map(({ lookup, file }) =>
	sourceDir("lookups", lookup, file),
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

const censusSmallAreaInputs = () => {
	const tables = Object.keys(SOURCES)
		.filter((name) => /^census-2021-ts\d/.test(name))
		.map((name) => name.slice("census-2021-".length));
	return tables.flatMap((table) => {
		const directory = sourceDir(`census-2021-${table}`);
		return [
			join(directory, "meta.json"),
			join(directory, `census2021-${table}-lsoa.csv`),
			join(directory, `census2021-${table}-msoa.csv`),
		];
	});
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
		sourceDir("census-2021-ts001", "census2021-ts001-oa.csv"),
		sourceDir("census-2021-ts003", "census2021-ts003-oa.csv"),
		sourceDir(
			"census-2022-scotland-output-area",
			"outputarea2022_usualresidentpopulation.csv",
		),
		sourceDir(
			"census-2022-scotland-output-area",
			"census_2022_UV406_Household_size_OA.csv",
		),
		sourceDir(
			"lookups",
			"output-area-to-lsoa/2021-12-ew/OA_LSOA_MSOA_EW_DEC_2021_LU_v3.geojson",
		),
		sourceDir(
			"population-weighted-centroids",
			"oa-2021-ew-v4/oa-2021-ew-pwc.csv",
		),
		sourceDir(
			"population-weighted-centroids",
			"oa-2022-sc/oa-2022-sc-pwc.csv",
		),
		sourceDir("council-tax-stock", "2026/CTSOP1_1_2026_03_31.csv"),
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
				sourceDir(
					"road-collisions",
					"dft-road-casualty-statistics-collision-provisional-2025.csv",
				),
			],
			presence,
		};
	} catch {
		return { paths: [""], presence: [] };
	}
};

export {
	datasetInputs,
	crosswalkInputs,
	sourceMetadataInputs,
	boundaryRegistryInputs,
	derivedBoundaryInputs,
	areaInventoryInputs,
	geometrySourceRegistryInputs,
	geometryStoreInputs,
	websiteBoundaryInputs,
	boundaryOffsetInputs,
	apiDatasetInputs,
	censusSmallAreaInputs,
	crosswalkWeightInputs,
	postcodeInputs,
	websiteDatasetInputs,
};
