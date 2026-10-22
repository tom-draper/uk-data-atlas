import { constants } from "fs";
import { copyFile, readFile } from "fs/promises";
import { join } from "path";
import { readCompiledFromDisk } from "./compileDataset.mts";
import { COMPILED_DATASETS, OUT_DIR } from "./paths.mts";
import type {
	CatalogueDefinition,
	CompiledDatasets,
	ExistingManifestDataset,
} from "./types.mts";

const RUN_COMPILE = "Run pnpm datasets:compile first.";

/**
 * Copies the named catalogue datasets from compiled/datasets into the folder
 * Next serves, and returns their manifest entries in the order given.
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
					`compiled/datasets has no ${definition.type}. ${RUN_COMPILE}`,
				);
			if (entry.fingerprint !== fingerprints[definition.type])
				throw new Error(
					`compiled/datasets/${entry.output}.json is out of date. ${RUN_COMPILE}`,
				);
			const file = `${definition.precompiledFile}.json`;
			// A copy-on-write clone where the file system has them, else a copy.
			await copyFile(
				join(COMPILED_DATASETS, file),
				join(OUT_DIR, file),
				constants.COPYFILE_FICLONE,
			);
			readCompiledFromDisk(definition, compiledDatasets);
			return entry;
		}),
	);
}
