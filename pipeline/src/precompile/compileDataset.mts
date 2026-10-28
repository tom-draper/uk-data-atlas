import { compileDatasetContents } from "@uk-data-atlas/datasets";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import {
	decodeCompactPayload,
	encodeCompactPayload,
} from "@uk-data-atlas/catalogue/compactPayload";
import { validatePrecompiledDataset } from "@uk-data-atlas/datasets";
import {
	elapsedSince,
	formatKb,
	logArtifact,
} from "../../../shared/buildTiming";
import { canReuseDataset, NO_REUSE } from "./cache.mts";
import { out } from "./output.mts";
import { COMPILED_DATASETS, SOURCE_DATA } from "./paths.mts";
import { createTrackedReader } from "./trackedReader.mts";
import { withDuckdbPublicHealth } from "./duckdbPublicHealth.mts";
import { compileDuckdbRoadCollisions } from "./duckdbRoadCollisions.mts";
import {
	withDuckdbImd,
	withDuckdbLocalElection,
	withDuckdbSchoolPerformance,
} from "./duckdbDatasetCsv.mts";
import type {
	CatalogueDefinition,
	CompiledDatasets,
	ExistingManifestDataset,
	ReuseContext,
} from "./types.mts";

/**
 * Registers a compiled dataset to be read back off disk if region chunks are
 * cut from it. Only the regional datasets are ever read back.
 */
export const readCompiledFromDisk = (
	definition: CatalogueDefinition,
	compiledDatasets: CompiledDatasets,
) => {
	if (definition.payload?.regionChunks?.kind !== "regional") return;
	compiledDatasets.set(definition.precompiledFile, {
		load: async () =>
			decodeCompactPayload(
				JSON.parse(
					await readFile(
						join(
							COMPILED_DATASETS,
							`${definition.precompiledFile}.json`,
						),
						"utf8",
					),
				),
			),
		layout: definition.payload,
	});
};

/**
 * The manifest entry of a dataset an earlier run compiled, when none of its
 * inputs have changed since. Undefined when it has to be compiled.
 */
export async function reuseDataset(
	definition: CatalogueDefinition,
	compiledDatasets: CompiledDatasets,
	{ datasetFingerprints, existingDatasets, sourceRelease }: ReuseContext,
) {
	const startedAt = performance.now();
	const existing = existingDatasets.get(definition.type);
	const cached = await canReuseDataset(
		existing,
		definition,
		sourceRelease,
		datasetFingerprints[definition.type],
	);
	if (!cached || !existing) return undefined;
	readCompiledFromDisk(definition, compiledDatasets);
	logArtifact("dataset", `${definition.precompiledFile}.json`, [
		"cached",
		formatKb(cached.bytes),
		elapsedSince(startedAt),
	]);
	return { ...existing, compiled: cached };
}

/**
 * Compiles one dataset into data/build/datasets, or reuses the file an earlier
 * run left when none of its inputs have changed. Returns the manifest entry.
 */
export async function compileDataset(
	definition: CatalogueDefinition,
	compiledDatasets: CompiledDatasets,
	reuse: ReuseContext = NO_REUSE,
) {
	return (
		(await reuseDataset(definition, compiledDatasets, reuse)) ??
		compileStaleDataset(
			definition,
			compiledDatasets,
			reuse.existingDatasets.get(definition.type),
			reuse.datasetFingerprints[definition.type],
		)
	);
}

/**
 * Compiles one dataset from its raw sources, whatever an earlier run left.
 * `existing` is its previous manifest entry, kept when the raw source is not
 * held locally.
 */
export async function compileStaleDataset(
	definition: CatalogueDefinition,
	compiledDatasets: CompiledDatasets,
	existing: ExistingManifestDataset | undefined,
	fingerprint: string | undefined,
) {
	const startedAt = performance.now();
	const { reader, artifacts } = createTrackedReader();
	let compiled: Awaited<ReturnType<typeof definition.precompile>>;
	let preserved: ExistingManifestDataset | undefined;
	try {
		compiled =
			definition.type === "publicHealth"
				? await withDuckdbPublicHealth(reader, artifacts, (input) =>
						compileDatasetContents(definition, input),
					)
				: definition.type === "roadCollisions"
					? await compileDatasetContents(
							{
								...definition,
								precompile: () =>
									compileDuckdbRoadCollisions(artifacts),
							},
							reader,
						)
					: definition.type === "localElection"
						? await withDuckdbLocalElection(
								reader,
								artifacts,
								(input) =>
									compileDatasetContents(definition, input),
							)
						: definition.type === "imd"
							? await withDuckdbImd(reader, artifacts, (input) =>
									compileDatasetContents(definition, input),
								)
							: definition.type === "schoolPerformance" ||
								  definition.type === "schoolPerformanceGap" ||
								  definition.type ===
										"schoolPerformanceConstituency"
								? await withDuckdbSchoolPerformance(
										reader,
										artifacts,
										definition.type === "schoolPerformance"
											? "Total"
											: definition.type ===
												  "schoolPerformanceGap"
												? "Disadvantage status"
												: "Constituency",
										(input) =>
											compileDatasetContents(
												definition,
												input,
											),
									)
								: await compileDatasetContents(
										definition,
										reader,
									);
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
			COMPILED_DATASETS,
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

		compiled = decodeCompactPayload(JSON.parse(content)) as typeof compiled;
		if (definition.coverageCountries) {
			compiled = Object.fromEntries(
				Object.entries(compiled).map(([id, dataset]) => [
					id,
					{
						...dataset,
						coverageCountries: definition.coverageCountries,
					},
				]),
			);
		}
		preserved = existing;
	}
	const data = compiled;
	// Region chunk generation is the sole downstream consumer of a compiled
	// payload. Retaining every dataset here needlessly keeps the entire atlas
	// in V8's heap until the last loader completes.
	if (definition.payload?.regionChunks?.kind === "regional") {
		compiledDatasets.set(definition.precompiledFile, {
			load: async () => data,
			layout: definition.payload,
		});
	}
	const summary = validatePrecompiledDataset(definition, data);
	if (preserved) {
		logArtifact("dataset", `${definition.precompiledFile}.json`, [
			"preserved, raw source unavailable",
			formatKb(preserved.compiled.bytes),
			elapsedSince(startedAt),
		]);
		return { ...preserved, fingerprint };
	}
	const output = await out(
		definition.precompiledFile,
		encodeCompactPayload(data),
		COMPILED_DATASETS,
	);
	logArtifact("dataset", `${definition.precompiledFile}.json`, [
		"compiled",
		formatKb(output.bytes),
		elapsedSince(startedAt),
	]);
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
		fingerprint,
	};
}
