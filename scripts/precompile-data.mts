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
 *
 * This file only sequences the run. Reading raw sources is in precompile/sources,
 * the cache that lets a run skip unchanged work is precompile/cache.mts, and each
 * stage of the pipeline has its own module in precompile/.
 */
import { readFile, mkdir, stat, utimes } from "fs/promises";
import { join } from "path";
import { parseBoundaryWardToLad } from "@uk-data-atlas/geography";

import { CATALOGUE_DATASET_DEFINITIONS } from "../lib/data/catalog";
import { discoverDatasets, type DiscoveredDataset } from "./dataset-discovery";
import { compileBoundaryAssets } from "./compile-boundaries.mts";
import { compileBoundaryChunks } from "./boundary-chunks";
import { writeDatasetRegionChunks } from "./dataset-region-chunks.mts";
import {
	mergeManifestEntries,
	parseOnlyArgument,
	selectDefinitions,
} from "./precompile-selection";
import { compileAtlasAssets } from "./precompile/atlasAssets.mts";
import {
	fileSnapshots,
	loadReuseContext,
	NO_REUSE,
} from "./precompile/cache.mts";
import { compileDataset } from "./precompile/compileDataset.mts";
import { chunksSize, out } from "./precompile/output.mts";
import { OUT_DIR, ROOT, SOURCE_DATA } from "./precompile/paths.mts";
import { compileRegionChunks } from "./precompile/regionChunks.mts";
import { precompileFingerprints } from "./precompile-fingerprint.mjs";
import { compileRoadSafety } from "./precompile/roadSafety.mts";
import type { CompiledDatasets } from "./precompile/types.mts";
import { elapsedSince, logArtifact } from "./timing.mts";

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
	const startedAt = performance.now();
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

	// Nothing is reused here, but each entry still records what compiled it.
	const { datasets: datasetFingerprints } =
		await precompileFingerprints(ROOT);
	const compiledDatasets: CompiledDatasets = new Map();
	const results: Awaited<ReturnType<typeof compileDataset>>[] = [];
	for (const definition of selected)
		results.push(
			await compileDataset(definition, compiledDatasets, {
				...NO_REUSE,
				datasetFingerprints,
			}),
		);

	const needsRegionChunks = selected.some(
		(definition) => definition.payload?.regionChunks?.kind === "regional",
	);
	if (needsRegionChunks) {
		const chunksStartedAt = performance.now();
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
		logArtifact("chunks", "chunks/", [
			"compiled",
			chunksSize(await fileSnapshots(join(OUT_DIR, "chunks"))),
			elapsedSince(chunksStartedAt),
		]);
	}

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
	console.log(`Precompile complete (${elapsedSince(startedAt)}).`);
}

async function main() {
	const only = parseOnlyArgument(process.argv.slice(2));
	if (only) return compileSelected(only);

	const startedAt = performance.now();
	await mkdir(OUT_DIR, { recursive: true });
	await compileBoundaryAssets();

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
		`Pre-compiling ${described.length - boundaries.length - lookups.length} datasets ` +
			`(data/ also holds ${boundaries.length} boundary releases and ${lookups.length} lookup tables)...`,
	);
	await verifyDescribedFiles(described);

	const compiledDatasets: CompiledDatasets = new Map();
	const { compilerFingerprint, ...reuse } = await loadReuseContext();

	// Dataset loaders can hold large source strings, parsed rows, compiled
	// records, and the JSON string being written at the same time. Starting all
	// loaders with map(async ...) creates a large, avoidable memory spike. Keep
	// the result metadata and compiled payloads, but only run one loader at a
	// time so the peak is bounded by the largest individual dataset.
	const chartResults: Awaited<ReturnType<typeof compileDataset>>[] = [];
	for (const definition of CATALOGUE_DATASET_DEFINITIONS) {
		chartResults.push(
			await compileDataset(definition, compiledDatasets, reuse),
		);
	}

	const atlasAssets = await compileAtlasAssets(reuse);
	const { gazetteerCore, boundaryMappings, matchIndex } = atlasAssets;
	const roadSafety = compileRoadSafety(reuse, gazetteerCore);
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
	atlasAssets.releaseBoundaryReads();
	// Chunks are placed by the gazetteer and lookups the assets above just wrote.
	await compileBoundaryChunks(ROOT);
	const regional = CATALOGUE_DATASET_DEFINITIONS.flatMap(
		(definition, index) =>
			definition.payload?.regionChunks?.kind === "regional"
				? [{ definition, compiled: chartResults[index]!.compiled }]
				: [],
	);
	const regionalDatasets = Object.fromEntries(
		regional.map(({ definition, compiled }) => [
			definition.precompiledFile,
			compiled,
		]),
	);
	// A dataset's layout is part of its definition, so chunks are only as
	// current as the fingerprint of each dataset they were cut from.
	const regionalFingerprints = Object.fromEntries(
		regional.map(({ definition }) => [
			definition.precompiledFile,
			reuse.datasetFingerprints[definition.type]!,
		]),
	);
	const recordedChunkOutputs = await compileRegionChunks(reuse, {
		regionalDatasets,
		regionalFingerprints,
		compiledDatasets,
		gazetteerCore: await gazetteerCore,
		boundaryMappings: await boundaryMappings,
	});
	await out("dataset-manifest", {
		version: 1,
		precompiler: { fingerprint: compilerFingerprint },
		artifacts: {
			atlasAssets: {
				inputs: atlasAssets.recordedBoundaryInputs,
				outputs: {
					gazetteerCore: (await gazetteerCore).compiled,
					matchIndex: await matchIndex,
				},
			},
			roadSafety: await roadSafety,
			regionChunks: {
				datasets: regionalDatasets,
				datasetFingerprints: regionalFingerprints,
				gazetteerCore: (await gazetteerCore).compiled,
				outputs: recordedChunkOutputs,
			},
		},
		datasets: results
			.slice(0, CATALOGUE_DATASET_DEFINITIONS.length)
			.map((result) => (result as PromiseFulfilledResult<unknown>).value),
	});

	console.log(`Precompile complete (${elapsedSince(startedAt)}).`);
}

await main();
