/**
 * Compiles every catalogue dataset from data/ into data/build/datasets, the one
 * copy the website and the API both read. A dataset whose inputs and compiler
 * are unchanged since the last run is reused rather than compiled again.
 *
 * Run via: pnpm data:build --only datasets
 *
 * `--only <dataset>[,<dataset>...]` recompiles just the named datasets, by
 * type or output file, and keeps the rest of the manifest as it was.
 */
import { mkdir } from "fs/promises";
import { join, relative } from "path";
import { CATALOGUE_DATASET_DEFINITIONS } from "@uk-data-atlas/datasets";
import { mergeManifestEntries, selectDefinitions } from "./selection.ts";
import { loadDatasetReuseContext, NO_REUSE } from "./cache.ts";
import { compileDataset } from "./compileDataset.ts";
import { compileDatasets } from "./datasetPool.ts";
import { out } from "./output.ts";
import { COMPILED_DATASETS, ROOT } from "./paths.ts";
import type { CompiledDatasets } from "./types.ts";
import { buildLog, elapsedSince, formatCount } from "@uk-data-atlas/atlas-db";
import { readJson } from "../lib/json.ts";

export const COMPILED_MANIFEST = join(
	COMPILED_DATASETS,
	"dataset-manifest.json",
);

type ManifestEntry = Awaited<ReturnType<typeof compileDataset>>;

const readManifest = async (): Promise<{ datasets: ManifestEntry[] }> => {
	try {
		return await readJson(COMPILED_MANIFEST);
	} catch {
		throw new Error(
			"No compiled dataset manifest to update. Run a full pnpm data:build --only datasets first.",
		);
	}
};

/**
 * Compiles the catalogue datasets, or only those named, into
 * data/build/datasets and rewrites its manifest. Regional datasets are
 * registered in `compiledDatasets` for anything that cuts chunks from them.
 */
export async function compileCatalogueDatasets(
	only: readonly string[] | null = null,
	compiledDatasets: CompiledDatasets = new Map(),
) {
	const startedAt = performance.now();
	await mkdir(COMPILED_DATASETS, { recursive: true });
	const reuse = await loadDatasetReuseContext();
	let datasets: ManifestEntry[];
	if (only) {
		const manifest = await readManifest();
		const selected = selectDefinitions(CATALOGUE_DATASET_DEFINITIONS, only);
		const results: ManifestEntry[] = [];
		// Nothing is reused here, but each entry still records what compiled it.
		for (const definition of selected)
			results.push(
				await compileDataset(definition, compiledDatasets, {
					...NO_REUSE,
					datasetFingerprints: reuse.datasetFingerprints,
				}),
			);
		datasets = mergeManifestEntries(
			manifest.datasets,
			results,
			CATALOGUE_DATASET_DEFINITIONS.map((definition) => definition.type),
		);
	} else {
		datasets = await compileDatasets(
			CATALOGUE_DATASET_DEFINITIONS,
			compiledDatasets,
			reuse,
		);
	}
	await out("dataset-manifest", { version: 1, datasets }, COMPILED_DATASETS);
	buildLog.info(
		`Compiled ${formatCount(datasets.length)} datasets into ${relative(ROOT, COMPILED_DATASETS)} in ${elapsedSince(startedAt)}`,
	);
	return datasets;
}
