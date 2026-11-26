import { STATISTICS_DATASETS } from "@uk-data-atlas/measures";
import type { DirectPart, SourceArtifact } from "@uk-data-atlas/datasets";
import { readFileSync, statSync } from "node:fs";
import { directDigest } from "./directDigest.ts";
import type { DirectParts } from "./directParts.ts";
import { join } from "node:path";
import { createTrackedReader } from "../precompile/trackedReader.ts";
import { sameFileStamp, sourceInputPath } from "../precompile/cache.ts";
import { datasetFingerprints } from "../precompile/fingerprint.mjs";
import { directPartsDirectory } from "../precompile/paths.ts";
import { sha256Hex } from "../lib/hash.ts";

type ManifestEntry = {
	type: string;
	output: string;
	inputs: SourceArtifact[];
	direct?: true;
	fingerprint?: string;
	inputTrackingVersion?: number;
	compiled: { sha256: string; bytes: number };
};

/** The types whose statistics rows are read from their sources, not compiled JSON. */
export const DIRECT_TYPES: readonly string[] = STATISTICS_DATASETS.filter(
	(config) => config.direct,
).map((config) => config.type);

/**
 * Reads every direct dataset's sources. The build is synchronous from here, so
 * this runs first. A direct reader must read only files the dataset's compiler
 * already reads: the `datasets` stage fingerprints those, so a changed source
 * reruns the statistics build, and the manifest's `inputs` name them.
 */
export async function readDirectParts(
	entryOf: (type: string) =>
		| {
				inputs: readonly { path: string }[];
				direct?: true;
				compiled: { sha256: string };
		  }
		| undefined,
	types: readonly string[] = DIRECT_TYPES,
): Promise<DirectParts> {
	const parts = new Map<string, readonly DirectPart[]>();
	for (const type of types) {
		const config = STATISTICS_DATASETS.find((entry) => entry.type === type);
		if (!config?.direct)
			throw new Error(`${type} does not read its sources directly`);
		const entry = entryOf(type);
		if (!entry)
			throw new Error(
				`${type} is not in the dataset manifest. Run pnpm data:build --only datasets first.`,
			);
		const { reader, artifacts } = createTrackedReader();
		const read = await config.direct.read(reader);
		const compiled = new Set(entry.inputs.map(({ path }) => path));
		for (const { path } of artifacts.values())
			if (!compiled.has(path))
				throw new Error(
					`${type}: its direct reader reads ${path}, which its compiler does not`,
				);
		if (entry.direct && directDigest(read).sha256 !== entry.compiled.sha256)
			throw new Error(
				`${type}: its sources changed since the datasets stage read them. Run pnpm data:build --only datasets.`,
			);
		parts.set(type, read);
	}
	return parts;
}

const readManifest = (directory: string) => {
	const manifest = JSON.parse(
		readFileSync(join(directory, "dataset-manifest.json"), "utf8"),
	) as { datasets: ManifestEntry[] };
	return new Map(manifest.datasets.map((entry) => [entry.type, entry]));
};

/** Read the publishers' inputs for parity checks independently of the handoff. */
export const readDirectPartsFor = (
	repositoryRoot: string,
	types?: readonly string[],
) => {
	const entries = readManifest(join(repositoryRoot, "data/build/datasets"));
	return readDirectParts((type) => entries.get(type), types);
};

function partsAreCurrent(
	path: string,
	entry: ManifestEntry,
	sourceDirectory: string,
) {
	if (
		statSync(path, { throwIfNoEntry: false })?.size !== entry.compiled.bytes
	)
		return false;
	return entry.inputs.every(({ input, kind, path }) => {
		const source = statSync(sourceInputPath(kind, path, sourceDirectory), {
			throwIfNoEntry: false,
		});
		return (
			source &&
			input &&
			sameFileStamp(input, {
				bytes: source.size,
				modifiedAt: source.mtimeMs,
			})
		);
	});
}

/**
 * Open the dataset stage's normalized parts on demand. Statistics reads each
 * dataset for planning and again for insertion, releasing the parts between
 * passes. Older manifests and changed input stamps use the source reader.
 */
export async function loadDirectPartsFor(
	repositoryRoot: string,
	types: readonly string[] = DIRECT_TYPES,
): Promise<DirectParts> {
	const directory = join(repositoryRoot, "data/build/datasets");
	const entries = readManifest(directory);
	const fingerprints = await datasetFingerprints(repositoryRoot);
	const sourceDirectory = join(repositoryRoot, "data/source");
	const loaders = new Map<string, () => readonly DirectPart[]>();
	for (const type of types) {
		const entry = entries.get(type);
		if (
			entry?.direct &&
			entry.inputTrackingVersion === 1 &&
			entry.fingerprint !== undefined &&
			entry.fingerprint === fingerprints[type]
		) {
			const path = join(
				directPartsDirectory(directory),
				`${entry.output}.json`,
			);
			if (partsAreCurrent(path, entry, sourceDirectory)) {
				loaders.set(type, () => {
					const content = readFileSync(path);
					if (
						content.length !== entry.compiled.bytes ||
						sha256Hex(content) !== entry.compiled.sha256
					)
						throw new Error(
							`${type}: normalized parts do not match the dataset manifest. Recompile it with node pipeline/src/stages/compile-datasets.ts --only ${type}.`,
						);
					return JSON.parse(content.toString("utf8")) as DirectPart[];
				});
				continue;
			}
		}
		const parts = (await readDirectParts(() => entry, [type])).get(type)!;
		loaders.set(type, () => parts);
	}
	return {
		has: (type) => loaders.has(type),
		get: (type) => loaders.get(type)?.(),
	};
}
