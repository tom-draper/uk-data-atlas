import { readFile } from "fs/promises";
import { join } from "path";
import { readCompiledFromDisk } from "../../pipeline/src/precompile/compileDataset.mts";
import { COMPILED_DATASETS } from "../../pipeline/src/precompile/paths.mts";
import type {
	CatalogueDefinition,
	CompiledDatasets,
	ExistingManifestDataset,
} from "../../pipeline/src/precompile/types.mts";

const RUN_COMPILE = "Run pnpm data:build --only datasets first.";

/**
 * Reads the named catalogue datasets from data/build/datasets and returns their
 * manifest entries in the order given.
 * Regional datasets are registered in `compiledDatasets` so their region
 * chunks can be cut. Fails if a dataset is missing or was compiled by a
 * different compiler than the current one.
 */
export async function publishDatasets(
	definitions: readonly CatalogueDefinition[],
	compiledDatasets: CompiledDatasets,
	fingerprints: Readonly<Record<string, string>>,
): Promise<ExistingManifestDataset[]> {
	let manifest: { datasets: ExistingManifestDataset[] };
	try {
		manifest = JSON.parse(
			await readFile(
				join(COMPILED_DATASETS, "dataset-manifest.json"),
				"utf8",
			),
		);
	} catch {
		throw new Error(
			`No compiled datasets in ${COMPILED_DATASETS}. ${RUN_COMPILE}`,
		);
	}
	const entries = new Map(
		manifest.datasets.map((entry) => [entry.type, entry]),
	);
	return Promise.all(
		definitions.map(async (definition) => {
			const entry = entries.get(definition.type);
			if (!entry || entry.output !== definition.precompiledFile)
				throw new Error(
					`data/build/datasets has no ${definition.type}. ${RUN_COMPILE}`,
				);
			if (entry.fingerprint !== fingerprints[definition.type])
				throw new Error(
					`data/build/datasets/${entry.output}.json is out of date. ${RUN_COMPILE}`,
				);
			readCompiledFromDisk(definition, compiledDatasets);
			return entry;
		}),
	);
}
