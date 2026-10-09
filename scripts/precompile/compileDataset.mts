import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import {
	decodeCompactPayload,
	encodeCompactPayload,
} from "../../lib/data/compactPayload";
import { validatePrecompiledDataset } from "../../lib/data/catalog";
import { elapsedSince, formatKb, logArtifact } from "../timing.mts";
import { canReuseDataset, NO_REUSE } from "./cache.mts";
import { out } from "./output.mts";
import { OUT_DIR, SOURCE_DATA } from "./paths.mts";
import { createTrackedReader } from "./trackedReader.mts";
import type {
	CatalogueDefinition,
	CompiledDatasets,
	ExistingManifestDataset,
	ReuseContext,
} from "./types.mts";

/**
 * Compiles one dataset into its browser JSON, or reuses the file an earlier
 * run left when none of its inputs have changed. Returns the manifest entry.
 */
export async function compileDataset(
	definition: CatalogueDefinition,
	compiledDatasets: CompiledDatasets,
	{
		datasetFingerprints,
		existingDatasets,
		sourceRelease,
	}: ReuseContext = NO_REUSE,
) {
	const startedAt = performance.now();
	const existing = existingDatasets.get(definition.type);
	const fingerprint = datasetFingerprints[definition.type];
	const cached = await canReuseDataset(
		existing,
		definition,
		sourceRelease,
		fingerprint,
	);
	if (cached && existing) {
		const reused = { ...existing, compiled: cached };
		if (definition.payload?.regionChunks?.kind === "regional") {
			compiledDatasets.set(definition.precompiledFile, {
				load: async () =>
					decodeCompactPayload(
						JSON.parse(
							await readFile(
								join(
									OUT_DIR,
									`${definition.precompiledFile}.json`,
								),
								"utf8",
							),
						),
					),
				layout: definition.payload,
			});
		}
		logArtifact("dataset", `${definition.precompiledFile}.json`, [
			"cached",
			formatKb(cached.bytes),
			elapsedSince(startedAt),
		]);
		return reused;
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

		compiled = decodeCompactPayload(JSON.parse(content)) as typeof compiled;
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
