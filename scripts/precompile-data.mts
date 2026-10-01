/**
 * Pre-compiles all CSV datasets into compact JSON files served to the browser.
 * Eliminates PapaParse from the client bundle and removes main-thread CSV parsing.
 *
 * Run via: pnpm precompile
 * Also runs automatically before pnpm dev and pnpm build.
 *
 * `--only <dataset>[,<dataset>...]` recompiles just the named datasets, by
 * type or output file, against the boundaries and gazetteer a full run has
 * already written: pnpm precompile:only claimantCount
 */
import {
	readFile,
	mkdir,
	readdir,
	rename,
	stat,
	utimes,
	writeFile,
} from "fs/promises";
import { createReadStream } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createHash } from "crypto";

import { CATALOGUE_DATASET_DEFINITIONS } from "../lib/data/catalog";
import {
	type SourceArtifact,
	validatePrecompiledDataset,
} from "../lib/data/catalog";
import type { DatasetReader } from "../lib/data/catalog";
import type { DatasetPayloadLayout } from "../lib/data/catalog/types";
import { discoverDatasets, type DiscoveredDataset } from "./dataset-discovery";
import {
	forEachXlsSheetRow,
	readWorkbookStream,
	xlsSheetRows,
} from "../lib/data/spreadsheet/xls";
import {
	forEachSheetRow,
	findSheetPath,
	parseSharedStrings,
	percentageStyles,
	rowsToCsv,
	sheetRows,
} from "../lib/data/spreadsheet/xlsx";
import { loadRoadSafety } from "../lib/data/road-safety/loader";
import { loadGazetteerCore } from "../lib/data/gazetteer/loader";
import { Gazetteer } from "../lib/data/gazetteer/gazetteer";
import { loadMatchIndex } from "../lib/data/gazetteer/matchIndex";
import {
	parseBoundaryWardToLad,
	parseParishLadMappings,
} from "../lib/data/boundaries/mappings";
import { compileBoundaryAssets } from "./compile-boundaries.mts";
import { writeDatasetRegionChunks } from "./dataset-region-chunks.mts";
import {
	mergeManifestEntries,
	parseOnlyArgument,
	selectDefinitions,
} from "./precompile-selection";
import { precompileFingerprint } from "./precompile-fingerprint.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DATA = join(ROOT, "public", "data");
const SOURCE_DATA = join(ROOT, "data");
// Browser-ready output is committed exactly where Next serves it from. Raw
// inputs remain in data/, which is restored from the pinned data release.
const OUT_DIR = join(PUBLIC_DATA, "datasets");

type ExistingManifestDataset = {
	type: string;
	output: string;
	source: unknown;
	contract: unknown;
	inputs: SourceArtifact[];
	summary: unknown;
	compiled: {
		bytes: number;
		sha256: string;
	};
};

type CompiledOutput = { bytes: number; sha256: string };

type SourceFileStamp = { bytes: number; modifiedAt: number };

type SourceRelease = {
	validatedAt: number;
	files: Set<string>;
};

type FileSnapshot = SourceFileStamp & {
	path: string;
	sha256?: string;
};

type AtlasAssetsCache = {
	inputs: FileSnapshot[];
	outputs: {
		gazetteerCore: CompiledOutput;
		matchIndex: CompiledOutput;
	};
};

type RoadSafetyCache = {
	input: SourceFileStamp;
	gazetteerCore: CompiledOutput;
	outputs: {
		dataset: CompiledOutput;
		points: CompiledOutput;
	};
};

type ExistingManifest = {
	precompiler?: { fingerprint?: string };
	datasets?: ExistingManifestDataset[];
	artifacts?: {
		atlasAssets?: AtlasAssetsCache;
		roadSafety?: RoadSafetyCache;
	};
};

// Read source datasets directly. public/data only contains files that must be
// served to the browser during local development.
const read = (path: string) => readFile(join(SOURCE_DATA, path), "utf8");

/**
 * Reads a compiled boundary asset. The compiler writes them to public/data,
 * where they are served from; the two releases published as TopoJSON rather
 * than GeoJSON are committed in data/ and copied across afterwards, so fall
 * back there for those.
 */
const readBoundaryAsset = async (path: string) => {
	try {
		return await readFile(join(PUBLIC_DATA, path), "utf8");
	} catch {
		return readFile(join(SOURCE_DATA, path), "utf8");
	}
};

/**
 * Pulls one named worksheet out of a legacy .xls and renders it as CSV. Some
 * publishers ship the workbook inside a zip — HPSSA is 128 MB uncompressed
 * against 36 MB zipped — so a zip holding a single .xls is unwrapped first.
 */
const readXlsWorkbook = async (path: string): Promise<Uint8Array> => {
	const fullPath = join(SOURCE_DATA, path);
	await stat(fullPath);
	return path.endsWith(".zip")
		? execSync(`unzip -p "${fullPath}" "*.xls"`, {
				maxBuffer: 512 * 1024 * 1024,
			})
		: await readFile(fullPath);
};

const readXlsSheet = async (
	path: string,
	sheetName: string,
): Promise<string> => {
	const bytes = await readXlsWorkbook(path);
	const stream = readWorkbookStream(new Uint8Array(bytes));
	return rowsToCsv(xlsSheetRows(stream, sheetName));
};

const visitXlsSheetRows = async (
	path: string,
	sheetName: string,
	visit: (row: ReadonlyMap<number, string>) => void,
) => {
	const bytes = await readXlsWorkbook(path);
	forEachXlsSheetRow(readWorkbookStream(bytes), sheetName, visit);
	return bytes;
};

// Reads a file relative to data/ (raw source data, not synced to public)
const readSource = (path: string) => readFile(join(SOURCE_DATA, path), "utf8");

// Extracts and reads the first CSV from a ZIP in data/ (never synced to public/)
const readZip = (path: string): Promise<string> => {
	const fullPath = join(SOURCE_DATA, path);
	return stat(fullPath).then(() =>
		execSync(`unzip -p "${fullPath}" "*.csv"`, {
			maxBuffer: 100 * 1024 * 1024,
		}).toString("utf8"),
	);
};

// Pulls one named worksheet out of an .xlsx and renders it as CSV, so the
// workbook can stay in data/ exactly as published and no extracted copy has to
// be committed alongside it.
const readXlsxSheetParts = async (
	fullPath: string,
	sheetName: string,
): Promise<{
	sheetXml: string;
	sharedStrings: string[];
	percentStyleIds: Set<number>;
}> => {
	await stat(fullPath);
	const entry = (name: string) =>
		execSync(`unzip -p "${fullPath}" "${name}"`, {
			maxBuffer: 512 * 1024 * 1024,
		}).toString("utf8");

	const sheetPath = findSheetPath(
		entry("xl/workbook.xml"),
		entry("xl/_rels/workbook.xml.rels"),
		sheetName,
	);
	// Not every workbook has a shared string table.
	let sharedStrings: string[] = [];
	try {
		sharedStrings = parseSharedStrings(entry("xl/sharedStrings.xml"));
	} catch {
		sharedStrings = [];
	}
	// Percentage-styled cells store their fraction (0.756), not the displayed
	// number (75.6), so the styles need reading too or every percentage comes
	// out a hundred times too small.
	const percentStyleIds = percentageStyles(entry("xl/styles.xml"));

	return {
		sheetXml: entry(sheetPath),
		sharedStrings,
		percentStyleIds,
	};
};

const readXlsxSheetFile = async (
	fullPath: string,
	sheetName: string,
): Promise<string> => {
	const { sheetXml, sharedStrings, percentStyleIds } =
		await readXlsxSheetParts(fullPath, sheetName);
	return rowsToCsv(sheetRows(sheetXml, sharedStrings, percentStyleIds));
};

const readXlsxSheet = (path: string, sheetName: string) =>
	readXlsxSheetFile(join(SOURCE_DATA, path), sheetName);

const visitXlsxSheetRows = async (
	path: string,
	sheetName: string,
	visit: (row: ReadonlyMap<number, string>) => void,
) => {
	const { sheetXml, sharedStrings, percentStyleIds } =
		await readXlsxSheetParts(join(SOURCE_DATA, path), sheetName);
	forEachSheetRow(sheetXml, sharedStrings, percentStyleIds, visit);
	return { sheetXml, sharedStrings, percentStyleIds };
};

// The worksheet XML alone does not fully describe an .xlsx input: values can
// be resolved through the shared-string table and percentages through styles.
// Keep all three in the tracked source artifact, so a cache hit cannot hide a
// change to either supporting file.
const xlsxRowsArtifact = ({
	sheetXml,
	sharedStrings,
	percentStyleIds,
}: {
	sheetXml: string;
	sharedStrings: string[];
	percentStyleIds: Set<number>;
}) =>
	JSON.stringify({
		sheetXml,
		sharedStrings,
		percentStyleIds: [...percentStyleIds].sort(
			(left, right) => left - right,
		),
	});

// ODS source files are never exposed by the application. The child-poverty
// loader only needs its worksheet XML, which is then reduced to compact JSON.
const readOdsContent = (path: string): Promise<string> => {
	const fullPath = join(SOURCE_DATA, path);
	return stat(fullPath).then(() =>
		execSync(`unzip -p "${fullPath}" content.xml`, {
			maxBuffer: 100 * 1024 * 1024,
		}).toString("utf8"),
	);
};

const writeAtomically = async (path: string, contents: string) => {
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

const elapsed = (startedAt: number) =>
	`${((performance.now() - startedAt) / 1_000).toFixed(2)}s`;

const timeStage = async <T,>(label: string, work: () => Promise<T>) => {
	const startedAt = performance.now();
	try {
		return await work();
	} finally {
		console.log(`  timing: ${label} ${elapsed(startedAt)}`);
	}
};

const out = async (name: string, data: unknown, log = true) => {
	const json = JSON.stringify(data);
	await writeAtomically(join(OUT_DIR, `${name}.json`), json);
	const kb = Math.round(Buffer.byteLength(json, "utf8") / 1024);
	if (log) console.log(`  dataset: ${name}.json (${kb} KB)`);
	return {
		bytes: Buffer.byteLength(json, "utf8"),
		sha256: createHash("sha256").update(json).digest("hex"),
	};
};

const createTrackedReader = () => {
	const artifacts = new Map<string, SourceArtifact>();
	const track = async (
		kind: SourceArtifact["kind"],
		path: string,
		readContent: () => Promise<string>,
	) => {
		const content = await readContent();
		artifacts.set(`${kind}:${path}`, {
			kind,
			path,
			bytes: Buffer.byteLength(content, "utf8"),
			sha256: createHash("sha256").update(content).digest("hex"),
			input: await fileStamp(sourceInputPath(kind, path)),
		});
		return content;
	};
	const trackXlsxRows = async (
		path: string,
		sheet: string,
		visit: (row: ReadonlyMap<number, string>) => void,
	) => {
		const input = await visitXlsxSheetRows(path, sheet, visit);
		const content = xlsxRowsArtifact(input);
		artifacts.set(`xlsxSheetRows:${path}#${sheet}`, {
			kind: "xlsxSheetRows",
			path: `${path}#${sheet}`,
			bytes: Buffer.byteLength(content, "utf8"),
			sha256: createHash("sha256").update(content).digest("hex"),
			input: await fileStamp(join(SOURCE_DATA, path)),
		});
	};
	const trackXlsRows = async (
		path: string,
		sheet: string,
		visit: (row: ReadonlyMap<number, string>) => void,
	) => {
		const bytes = await visitXlsSheetRows(path, sheet, visit);
		artifacts.set(`xlsSheetRows:${path}#${sheet}`, {
			kind: "xlsSheetRows",
			path: `${path}#${sheet}`,
			bytes: bytes.byteLength,
			sha256: createHash("sha256").update(bytes).digest("hex"),
			input: await fileStamp(join(SOURCE_DATA, path)),
		});
	};
	const reader: DatasetReader = {
		text: (path) => track("text", path, () => read(path)),
		xlsxSheet: (path, sheet) =>
			track("xlsxSheet", `${path}#${sheet}`, () =>
				readXlsxSheet(path, sheet),
			),
		xlsxSheetRows: (path, sheet, visit) =>
			trackXlsxRows(path, sheet, visit),
		xlsSheet: (path, sheet) =>
			track("xlsSheet", `${path}#${sheet}`, () =>
				readXlsSheet(path, sheet),
			),
		xlsSheetRows: (path, sheet, visit) => trackXlsRows(path, sheet, visit),
		odsContent: (path) =>
			track("odsContent", path, () => readOdsContent(path)),
		zipCsv: (path) => track("zipCsv", path, () => readZip(path)),
	};
	return { reader, artifacts };
};

const splitSheetArtifactPath = (path: string): [string, string] => {
	const separator = path.lastIndexOf("#");
	if (separator === -1)
		throw new Error(`Expected worksheet source artifact, got ${path}`);
	return [path.slice(0, separator), path.slice(separator + 1)];
};

const sourceInputPath = (kind: SourceArtifact["kind"], path: string) =>
	join(
		SOURCE_DATA,
		kind === "xlsxSheet" ||
			kind === "xlsxSheetRows" ||
			kind === "xlsSheet" ||
			kind === "xlsSheetRows"
			? splitSheetArtifactPath(path)[0]
			: path,
	);

const fileStamp = async (path: string): Promise<SourceFileStamp> => {
	const input = await stat(path);
	return { bytes: input.size, modifiedAt: input.mtimeMs };
};

const sameFileStamp = (left: SourceFileStamp, right: SourceFileStamp) =>
	left.bytes === right.bytes && left.modifiedAt === right.modifiedAt;

// Raw data is restored from an immutable, checksummed release. Restoring it
// necessarily gives every file a new mtime, which must not discard otherwise
// valid compiled datasets. The marker is written only after that release has
// been verified; any local edit made later has a newer mtime and still forces
// its dependent dataset to rebuild.
const readSourceRelease = async (): Promise<SourceRelease | undefined> => {
	try {
		const path = join(SOURCE_DATA, ".source-release.json");
		const [contents, marker] = await Promise.all([
			readFile(path, "utf8"),
			stat(path),
		]);
		const parsed: unknown = JSON.parse(contents);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("version" in parsed) ||
			parsed.version !== 2 ||
			!("files" in parsed) ||
			typeof parsed.files !== "object" ||
			parsed.files === null
		)
			return undefined;
		const files = Object.entries(parsed.files).filter(
			([, sha256]) => typeof sha256 === "string",
		);
		return {
			validatedAt: marker.mtimeMs,
			files: new Set(files.map(([path]) => path)),
		};
	} catch {
		return undefined;
	}
};

const isReleasedSource = (
	release: SourceRelease | undefined,
	path: string,
	input: SourceFileStamp,
) =>
	release !== undefined &&
	input.modifiedAt <= release.validatedAt &&
	release.files.has(relative(SOURCE_DATA, path));

const fileHash = async (path: string) => {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest("hex");
};

const fileSnapshots = async (
	directory: string,
	prefix = "",
): Promise<FileSnapshot[]> => {
	const snapshots: FileSnapshot[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		const relative = join(prefix, entry.name);
		if (entry.isDirectory())
			snapshots.push(...(await fileSnapshots(path, relative)));
		else if (entry.isFile())
			snapshots.push({ path: relative, ...(await fileStamp(path)) });
	}
	return snapshots.sort((left, right) => left.path.localeCompare(right.path));
};

const sameFileSnapshots = async (
	left: readonly FileSnapshot[],
	right: readonly FileSnapshot[],
	directory: string,
) => {
	if (left.length !== right.length) return false;
	for (const [index, snapshot] of left.entries()) {
		const current = right[index];
		if (!current || snapshot.path !== current.path) return false;
		if (sameFileStamp(snapshot, current)) continue;
		if (
			!snapshot.sha256 ||
			(await fileHash(join(directory, current.path))) !== snapshot.sha256
		)
			return false;
	}
	return true;
};

const snapshotFileContents = async (
	snapshots: readonly FileSnapshot[],
	directory: string,
) =>
	Promise.all(
		snapshots.map(async (snapshot) => ({
			...snapshot,
			sha256: await fileHash(join(directory, snapshot.path)),
		})),
	);

const outputMatches = async (name: string, expected: CompiledOutput) => {
	try {
		const output = await readFile(join(OUT_DIR, `${name}.json`));
		return (
			output.byteLength === expected.bytes &&
			createHash("sha256").update(output).digest("hex") ===
				expected.sha256
		);
	} catch {
		return false;
	}
};

const isSourceArtifact = (value: unknown): value is SourceArtifact =>
	typeof value === "object" &&
	value !== null &&
	"kind" in value &&
	"path" in value &&
	"bytes" in value &&
	"sha256" in value &&
	"input" in value &&
	typeof value.kind === "string" &&
	typeof value.path === "string" &&
	typeof value.bytes === "number" &&
	typeof value.sha256 === "string" &&
	typeof value.input === "object" &&
	value.input !== null &&
	"bytes" in value.input &&
	"modifiedAt" in value.input &&
	typeof value.input.bytes === "number" &&
	typeof value.input.modifiedAt === "number";

const canReuseDataset = async (
	existing: ExistingManifestDataset | undefined,
	definition: (typeof CATALOGUE_DATASET_DEFINITIONS)[number],
	sourceRelease: SourceRelease | undefined,
) => {
	if (
		!existing ||
		existing.type !== definition.type ||
		existing.output !== definition.precompiledFile ||
		!Array.isArray(existing.inputs) ||
		!existing.inputs.every(isSourceArtifact)
	)
		return false;

	try {
		for (const artifact of existing.inputs) {
			const path = sourceInputPath(artifact.kind, artifact.path);
			const input = await fileStamp(path);
			if (
				!sameFileStamp(artifact.input, input) &&
				!isReleasedSource(sourceRelease, path, input)
			)
				return false;
		}
		const output = await readFile(
			join(OUT_DIR, `${definition.precompiledFile}.json`),
		);
		return (
			output.byteLength === existing.compiled.bytes &&
			createHash("sha256").update(output).digest("hex") ===
				existing.compiled.sha256
		);
	} catch {
		return false;
	}
};

/** Checks that every file a meta.json promises is actually present. */
async function verifyDescribedFiles(
	described: DiscoveredDataset[],
): Promise<void> {
	const missing: string[] = [];
	for (const dataset of described) {
		for (const file of dataset.meta.files) {
			try {
				await stat(join(dataset.dir, file.path));
			} catch {
				missing.push(`${dataset.id}/${file.path}`);
			}
		}
	}
	if (missing.length > 0) {
		throw new Error(
			`meta.json lists files that do not exist:\n  ${missing.join("\n  ")}`,
		);
	}
}

/**
 * Recompiles only the named datasets and folds them into the existing
 * manifest. The boundary assets, gazetteer and mappings are read as a full run
 * last wrote them rather than rebuilt, which is what makes this quick.
 */
async function compileSelected(names: readonly string[]) {
	const selected = selectDefinitions(CATALOGUE_DATASET_DEFINITIONS, names);
	console.log(
		`Pre-compiling ${selected.map((definition) => definition.type).join(", ")}...`,
	);
	const manifestPath = join(OUT_DIR, "dataset-manifest.json");
	let manifest: { datasets: { type: string }[] };
	let manifestTimes: { atime: Date; mtime: Date };
	try {
		manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		manifestTimes = await stat(manifestPath);
	} catch {
		throw new Error(
			"No dataset manifest to update. Run a full pnpm precompile first.",
		);
	}

	const compiledDatasets = new Map<
		string,
		{ data: unknown; layout?: DatasetPayloadLayout }
	>();
	const results: Awaited<ReturnType<typeof compileDataset>>[] = [];
	for (const definition of selected)
		results.push(await compileDataset(definition, compiledDatasets));

	const needsRegionChunks = selected.some(
		(definition) => definition.payload?.regionChunks?.kind === "regional",
	);
	if (needsRegionChunks)
		await writeDatasetRegionChunks({
			root: ROOT,
			datasets: compiledDatasets,
			core: JSON.parse(
				await readFile(join(OUT_DIR, "gazetteer.core.json"), "utf8"),
			),
			boundaryMappings: {
				wardToLad: parseBoundaryWardToLad(
					JSON.parse(
						await readFile(
							join(OUT_DIR, "boundary-mappings.json"),
							"utf8",
						),
					),
				),
			},
		});

	await out("dataset-manifest", {
		...manifest,
		datasets: mergeManifestEntries(
			manifest.datasets,
			results,
			CATALOGUE_DATASET_DEFINITIONS.map((definition) => definition.type),
		),
	});
	// precompile:if-needed treats a manifest newer than data/ as proof that
	// everything is current. Only some datasets were rebuilt here, so keep the
	// manifest's old timestamp and leave that judgement as a full run left it.
	await utimes(manifestPath, manifestTimes.atime, manifestTimes.mtime);
	console.log("Done.");
}

async function main() {
	const only = parseOnlyArgument(process.argv.slice(2));
	if (only) return compileSelected(only);

	console.log("Pre-compiling datasets...");
	const startedAt = performance.now();
	await mkdir(OUT_DIR, { recursive: true });
	const boundariesStartedAt = performance.now();
	await compileBoundaryAssets();
	console.log(`  timing: boundary assets ${elapsed(boundariesStartedAt)}`);

	// Every folder in data/ carrying a meta.json is a dataset. Reading them all
	// first means a malformed drop fails the build immediately, with the folder
	// named, rather than surfacing later as a confusing loader error.
	const described = await discoverDatasets(SOURCE_DATA);
	const boundaries = described.filter(
		(dataset) => dataset.meta.kind === "boundary",
	);
	const lookups = described.filter(
		(dataset) => dataset.meta.kind === "lookup",
	);
	console.log(
		`  described datasets: ${described.length - boundaries.length - lookups.length} ` +
			`(and ${boundaries.length} boundary releases, ${lookups.length} lookup tables)`,
	);
	await verifyDescribedFiles(described);

	const compiledDatasets = new Map<
		string,
		{ data: unknown; layout?: DatasetPayloadLayout }
	>();
	let existingManifest: ExistingManifest = {};
	try {
		existingManifest = JSON.parse(
			await readFile(join(OUT_DIR, "dataset-manifest.json"), "utf8"),
		);
	} catch {
		// A fresh checkout has no cache to reuse.
	}
	const compilerFingerprint = await precompileFingerprint(ROOT);
	const sourceRelease = await readSourceRelease();
	const canReuse =
		existingManifest.precompiler?.fingerprint === compilerFingerprint;
	if (!canReuse)
		console.log(
			"  cache: compiler inputs changed; rebuilding all datasets",
		);
	const existingDatasets = new Map(
		(existingManifest.datasets ?? []).map((dataset) => [
			dataset.type,
			dataset,
		]),
	);
	// Dataset loaders can hold large source strings, parsed rows, compiled
	// records, and the JSON string being written at the same time. Starting all
	// loaders with map(async ...) creates a large, avoidable memory spike. Keep
	// the result metadata and compiled payloads, but only run one loader at a
	// time so the peak is bounded by the largest individual dataset.
	const chartResults: Awaited<ReturnType<typeof compileDataset>>[] = [];
	for (const definition of CATALOGUE_DATASET_DEFINITIONS) {
		chartResults.push(
			await compileDataset(
				definition,
				compiledDatasets,
				existingDatasets,
				canReuse,
				sourceRelease,
				performance.now(),
			),
		);
	}
	const boundaryDirectory = join(PUBLIC_DATA, "boundaries");
	const boundaryInputs = await fileSnapshots(boundaryDirectory);
	// The gazetteer, mappings and upload index all traverse overlapping boundary
	// releases. Share each raw asset for this build; each loader still owns its
	// decoded representation, so their contracts and mutations remain isolated.
	const boundaryReads = new Map<string, Promise<string>>();
	const readBoundaryOnce = (path: string) => {
		let content = boundaryReads.get(path);
		if (!content) {
			content = readBoundaryAsset(path);
			boundaryReads.set(path, content);
		}
		return content;
	};
	const cachedAtlasAssets = existingManifest.artifacts?.atlasAssets;
	const hasBoundaryContentHashes =
		cachedAtlasAssets?.inputs.every(
			(snapshot) => typeof snapshot.sha256 === "string",
		) ?? false;
	const canReuseAtlasAssets =
		canReuse &&
		cachedAtlasAssets &&
		hasBoundaryContentHashes &&
		(await sameFileSnapshots(
			cachedAtlasAssets.inputs,
			boundaryInputs,
			boundaryDirectory,
		)) &&
		(await outputMatches(
			"gazetteer.core",
			cachedAtlasAssets.outputs.gazetteerCore,
		)) &&
		(await outputMatches(
			"gazetteer.matchindex",
			cachedAtlasAssets.outputs.matchIndex,
		));

	const gazetteerCore = canReuseAtlasAssets
		? Promise.resolve({
				data: JSON.parse(
					await readFile(
						join(OUT_DIR, "gazetteer.core.json"),
						"utf8",
					),
				),
				compiled: cachedAtlasAssets.outputs.gazetteerCore,
			})
		: timeStage("gazetteer core", () =>
				loadGazetteerCore(readBoundaryOnce).then(async (data) => ({
					data,
					compiled: await out("gazetteer.core", data),
				})),
			);
	// Ward and parish containment come from the API's geography resolver,
	// written by `pnpm containment:build` and committed; upload matching reads
	// ward and parish parents from them, so the index is compiled in step.
	// Both files are part of the precompiler fingerprint, so a cached index
	// is only reused while they are unchanged.
	const boundaryMappings = readFile(
		join(OUT_DIR, "boundary-mappings.json"),
		"utf8",
	).then((json) => ({ wardToLad: parseBoundaryWardToLad(JSON.parse(json)) }));
	const parishToLad = readFile(
		join(OUT_DIR, "parish-lad-mappings.json"),
		"utf8",
	).then((json) => parseParishLadMappings(JSON.parse(json)));
	const matchIndex = canReuseAtlasAssets
		? Promise.resolve(cachedAtlasAssets.outputs.matchIndex)
		: timeStage("gazetteer match index", () =>
				Promise.all([boundaryMappings, parishToLad]).then(
					async ([{ wardToLad }, parishParents]) =>
						out(
							"gazetteer.matchindex",
							await loadMatchIndex(
								readBoundaryOnce,
								wardToLad,
								parishParents,
							),
						),
				),
			);
	if (canReuseAtlasAssets) console.log("  atlas assets: cached");
	const recordedBoundaryInputs = canReuseAtlasAssets
		? boundaryInputs.map((snapshot, index) => ({
				...snapshot,
				sha256: cachedAtlasAssets.inputs[index]!.sha256,
			}))
		: await snapshotFileContents(boundaryInputs, boundaryDirectory);
	// The collisions are written apart from the dataset that describes them, so
	// the card can be drawn from the small file and the 6 MB of points is only
	// fetched once someone selects the dataset. Counting them per location needs
	// the gazetteer's bounding boxes, so this waits on the core built above.
	const roadSafety = timeStage("road safety", () =>
		gazetteerCore.then(async ({ data: core, compiled: coreOutput }) => {
			const input = await fileStamp(
				join(
					SOURCE_DATA,
					"transport/road-safety/dft-road-casualty-statistics-collision-provisional-2025.csv",
				),
			);
			const cached = existingManifest.artifacts?.roadSafety;
			if (
				canReuse &&
				cached &&
				sameFileStamp(cached.input, input) &&
				cached.gazetteerCore.sha256 === coreOutput.sha256 &&
				cached.gazetteerCore.bytes === coreOutput.bytes &&
				(await outputMatches("road-safety", cached.outputs.dataset)) &&
				(await outputMatches(
					"road-safety-points",
					cached.outputs.points,
				))
			) {
				console.log("  dataset: road-safety.json (cached)");
				console.log("  dataset: road-safety-points.json (cached)");
				return cached;
			}

			const { datasets, points } = await loadRoadSafety(
				readSource,
				new Gazetteer(core),
			);
			return {
				input,
				gazetteerCore: coreOutput,
				outputs: {
					dataset: await out("road-safety", datasets),
					points: await out("road-safety-points", points),
				},
			};
		}),
	);
	const results = await Promise.allSettled([
		...chartResults,
		roadSafety,
		gazetteerCore,
		boundaryMappings,
		matchIndex,
	]);

	const failures = results.filter(
		(r): r is PromiseRejectedResult => r.status === "rejected",
	);
	if (failures.length > 0) {
		for (const f of failures) console.error("  ERROR:", f.reason);
		process.exit(1);
	}
	boundaryReads.clear();
	await timeStage("regional chunks", async () =>
		writeDatasetRegionChunks({
			root: ROOT,
			datasets: compiledDatasets,
			core: (await gazetteerCore).data,
			boundaryMappings: await boundaryMappings,
		}),
	);
	await out("dataset-manifest", {
		version: 1,
		precompiler: { fingerprint: compilerFingerprint },
		artifacts: {
			atlasAssets: {
				inputs: recordedBoundaryInputs,
				outputs: {
					gazetteerCore: (await gazetteerCore).compiled,
					matchIndex: await matchIndex,
				},
			},
			roadSafety: await roadSafety,
		},
		datasets: results
			.slice(0, CATALOGUE_DATASET_DEFINITIONS.length)
			.map((result) => (result as PromiseFulfilledResult<unknown>).value),
	});

	console.log(`Done in ${elapsed(startedAt)}.`);
}

async function compileDataset(
	definition: (typeof CATALOGUE_DATASET_DEFINITIONS)[number],
	compiledDatasets: Map<
		string,
		{ data: unknown; layout?: DatasetPayloadLayout }
	>,
	existingDatasets = new Map<string, ExistingManifestDataset>(),
	canReuse = false,
	sourceRelease: SourceRelease | undefined = undefined,
	startedAt = performance.now(),
) {
	const existing = existingDatasets.get(definition.type);
	if (
		canReuse &&
		(await canReuseDataset(existing, definition, sourceRelease))
	) {
		if (definition.payload?.regionChunks?.kind === "regional") {
			compiledDatasets.set(definition.precompiledFile, {
				data: JSON.parse(
					await readFile(
						join(OUT_DIR, `${definition.precompiledFile}.json`),
						"utf8",
					),
				),
				layout: definition.payload,
			});
		}
		console.log(
			`  dataset: ${definition.precompiledFile}.json (cached; ${Math.round(existing.compiled.bytes / 1024)} KB; ${elapsed(startedAt)})`,
		);
		return existing;
	}
	const { reader, artifacts } = createTrackedReader();
	let compiled: Awaited<ReturnType<typeof definition.precompile>>;
	let preserved: ExistingManifestDataset | undefined;
	try {
		compiled = await definition.precompile(reader);
	} catch (error) {
		const missingRawSource =
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT" &&
			"path" in error &&
			typeof error.path === "string" &&
			error.path.startsWith(SOURCE_DATA);

		if (!missingRawSource) throw error;

		const compiledPath = join(
			OUT_DIR,
			`${definition.precompiledFile}.json`,
		);
		if (!existing || existing.output !== definition.precompiledFile)
			throw error;

		const content = await readFile(compiledPath, "utf8");
		const actualSha256 = createHash("sha256").update(content).digest("hex");
		if (actualSha256 !== existing.compiled.sha256) {
			throw new Error(
				`Cannot preserve ${definition.type}: ${compiledPath} does not match dataset-manifest.json`,
			);
		}

		compiled = JSON.parse(content);
		preserved = existing;
	}
	const data = definition.coverageCountries
		? Object.fromEntries(
				Object.entries(compiled).map(([id, dataset]) => [
					id,
					{
						...dataset,
						coverageCountries: definition.coverageCountries,
					},
				]),
			)
		: compiled;
	// Region chunk generation is the sole downstream consumer of a compiled
	// payload. Retaining every dataset here needlessly keeps the entire atlas
	// in V8's heap until the last loader completes.
	if (definition.payload?.regionChunks?.kind === "regional") {
		compiledDatasets.set(definition.precompiledFile, {
			data,
			layout: definition.payload,
		});
	}
	const summary = validatePrecompiledDataset(definition, data);
	if (preserved) {
		console.log(
			`  dataset: ${definition.precompiledFile}.json (preserved; raw source unavailable; ${elapsed(startedAt)})`,
		);
		return preserved;
	}
	const output = await out(definition.precompiledFile, data, false);
	console.log(
		`  dataset: ${definition.precompiledFile}.json (${Math.round(output.bytes / 1024)} KB; ${elapsed(startedAt)})`,
	);
	return {
		type: definition.type,
		output: definition.precompiledFile,
		source: definition.source,
		contract: definition.ingestion ?? {},
		inputs: [...artifacts.values()].sort((left, right) =>
			left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
		),
		summary,
		compiled: output,
	};
}

await main();
