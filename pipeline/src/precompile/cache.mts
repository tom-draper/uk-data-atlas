import { createHash } from "crypto";
import { createReadStream } from "fs";
import { readFile, readdir, stat } from "fs/promises";
import { join, relative } from "path";
import type { SourceArtifact } from "@uk-data-atlas/datasets";
import { datasetFingerprints, precompileFingerprints } from "./fingerprint.mjs";
import { COMPILED_DATASETS, ROOT, SOURCE_DATA } from "./paths.mts";
import type {
	CatalogueDefinition,
	CompiledOutput,
	ExistingManifest,
	ExistingManifestDataset,
	FileSnapshot,
	ReuseContext,
	SourceFileStamp,
	SourceRelease,
} from "./types.mts";

const splitSheetArtifactPath = (path: string): [string, string] => {
	const separator = path.lastIndexOf("#");
	if (separator === -1)
		throw new Error(`Expected worksheet source artifact, got ${path}`);
	return [path.slice(0, separator), path.slice(separator + 1)];
};

/** The file under data/ that a tracked source artifact was read from. */
export const sourceInputPath = (kind: SourceArtifact["kind"], path: string) =>
	join(
		SOURCE_DATA,
		kind === "xlsxSheet" ||
			kind === "xlsxSheetRows" ||
			kind === "xlsxSheetSelectedRows" ||
			kind === "xlsSheet" ||
			kind === "xlsSheetRows" ||
			kind === "odsTableRows"
			? splitSheetArtifactPath(path)[0]
			: path,
	);

export const fileStamp = async (path: string): Promise<SourceFileStamp> => {
	const input = await stat(path);
	return { bytes: input.size, modifiedAt: input.mtimeMs };
};

export const sameFileStamp = (left: SourceFileStamp, right: SourceFileStamp) =>
	left.bytes === right.bytes && left.modifiedAt === right.modifiedAt;

export const sameCompiledOutput = (
	left: CompiledOutput,
	right: CompiledOutput,
) => left.bytes === right.bytes && left.sha256 === right.sha256;

export const sameCompiledOutputs = (
	left: Readonly<Record<string, CompiledOutput>>,
	right: Readonly<Record<string, CompiledOutput>>,
) => {
	const leftEntries = Object.entries(left).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	const rightEntries = Object.entries(right).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	return (
		leftEntries.length === rightEntries.length &&
		leftEntries.every(
			([name, output], index) =>
				name === rightEntries[index]?.[0] &&
				sameCompiledOutput(output, rightEntries[index]![1]),
		)
	);
};

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
			(parsed.version !== 2 && parsed.version !== 3) ||
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

export const isReleasedSource = (
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

export const fileSnapshots = async (
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

export const fileSnapshotsOrEmpty = async (directory: string) => {
	try {
		return await fileSnapshots(directory);
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT"
		)
			return [];
		throw error;
	}
};

export const sameFileSnapshots = async (
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

export const snapshotFileContents = async (
	snapshots: readonly FileSnapshot[],
	directory: string,
) =>
	Promise.all(
		snapshots.map(async (snapshot) => ({
			...snapshot,
			sha256: await fileHash(join(directory, snapshot.path)),
		})),
	);

/**
 * The compiled file `name`.json in `directory` as it now stands, if it still
 * matches what the manifest recorded. An unchanged mtime is taken as proof;
 * otherwise the contents are hashed.
 */
const cachedDatasetOutput = async (
	name: string,
	expected: CompiledOutput,
	directory: string,
): Promise<CompiledOutput | undefined> => {
	try {
		const path = join(directory, `${name}.json`);
		const output = await stat(path);
		if (output.size !== expected.bytes) return undefined;
		if (expected.modifiedAt === output.mtimeMs)
			return { ...expected, modifiedAt: output.mtimeMs };
		const contents = await readFile(path);
		if (
			createHash("sha256").update(contents).digest("hex") !==
			expected.sha256
		)
			return undefined;
		return { ...expected, modifiedAt: output.mtimeMs };
	} catch {
		return undefined;
	}
};

export const outputMatches = async (
	name: string,
	expected: CompiledOutput,
	directory: string,
) => (await cachedDatasetOutput(name, expected, directory)) !== undefined;

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

/** The reusable compiled output for a dataset, or undefined if it is stale. */
export const canReuseDataset = async (
	existing: ExistingManifestDataset | undefined,
	definition: CatalogueDefinition,
	sourceRelease: SourceRelease | undefined,
	fingerprint: string | undefined,
) => {
	if (
		!existing ||
		fingerprint === undefined ||
		existing.fingerprint !== fingerprint ||
		existing.type !== definition.type ||
		existing.output !== definition.precompiledFile ||
		!Array.isArray(existing.inputs) ||
		!existing.inputs.every(isSourceArtifact)
	)
		return undefined;

	try {
		for (const artifact of existing.inputs) {
			const path = sourceInputPath(artifact.kind, artifact.path);
			const input = await fileStamp(path);
			if (
				!sameFileStamp(artifact.input, input) &&
				!isReleasedSource(sourceRelease, path, input)
			)
				return undefined;
		}
		return cachedDatasetOutput(
			definition.precompiledFile,
			existing.compiled,
			COMPILED_DATASETS,
		);
	} catch {
		return undefined;
	}
};

/** The reuse context for a run that trusts nothing an earlier one left. */
export const NO_REUSE: ReuseContext = {
	canReuse: false,
	datasetFingerprints: {},
	existingManifest: {},
	existingDatasets: new Map(),
	sourceRelease: undefined,
};

/**
 * The manifest an earlier run wrote in `directory`, or an empty one in a fresh
 * checkout.
 */
const readExistingManifest = async (
	directory: string,
): Promise<ExistingManifest> => {
	try {
		return JSON.parse(
			await readFile(join(directory, "dataset-manifest.json"), "utf8"),
		);
	} catch {
		return {};
	}
};

const byType = (manifest: ExistingManifest) =>
	new Map(
		(manifest.datasets ?? []).map((dataset) => [dataset.type, dataset]),
	);

/**
 * The reuse context for compiling the catalogue datasets into
 * data/build/datasets. A dataset is reused only if what compiles it is
 * unchanged, which its own fingerprint says.
 */
export const loadDatasetReuseContext = async (): Promise<ReuseContext> => {
	const existingManifest = await readExistingManifest(COMPILED_DATASETS);
	return {
		canReuse: false,
		datasetFingerprints: await datasetFingerprints(ROOT),
		existingManifest,
		existingDatasets: byType(existingManifest),
		sourceRelease: await readSourceRelease(),
	};
};

/**
 * Reads the manifest an earlier website run wrote, and decides whether its
 * output can be reused. Its artifacts share the pipeline's fingerprint.
 */
export const loadReuseContext = async (
	directory: string,
): Promise<ReuseContext & { compilerFingerprint: string }> => {
	const existingManifest = await readExistingManifest(directory);
	const { pipeline: compilerFingerprint, datasets: datasetFingerprints } =
		await precompileFingerprints(ROOT);
	const sourceRelease = await readSourceRelease();
	const canReuse =
		existingManifest.precompiler?.fingerprint === compilerFingerprint;
	const existingDatasets = byType(existingManifest);
	return {
		canReuse,
		datasetFingerprints,
		existingManifest,
		existingDatasets,
		sourceRelease,
		compilerFingerprint,
	};
};
