/**
 * A worker thread that compiles the datasets datasetPool.mts hands it, one at
 * a time, and posts back each manifest entry.
 */
import { parentPort } from "worker_threads";
import { CATALOGUE_DATASET_DEFINITIONS } from "@uk-data-atlas/datasets";
import { compileStaleDataset } from "./compileDataset.mts";
import type { ExistingManifestDataset } from "./types.mts";

export type DatasetJob = {
	index: number;
	type: string;
	existing: ExistingManifestDataset | undefined;
	fingerprint: string | undefined;
};

export type DatasetJobResult =
	{ index: number; entry: string } | { index: number; error: unknown };

if (!parentPort) throw new Error("datasetWorker.mts must run as a worker.");
const port = parentPort;

port.on(
	"message",
	async ({ index, type, existing, fingerprint }: DatasetJob) => {
		try {
			const definition = CATALOGUE_DATASET_DEFINITIONS.find(
				(candidate) => candidate.type === type,
			);
			if (!definition) throw new Error(`Unknown dataset ${type}.`);
			const entry = await compileStaleDataset(
				definition,
				// The payload stays here; the pool reads it back off disk if needed.
				new Map(),
				existing,
				fingerprint,
			);
			// An entry is only ever written to the manifest, so send it as the JSON
			// it will become rather than requiring every field to be cloneable.
			port.postMessage({
				index,
				entry: JSON.stringify(entry),
			} satisfies DatasetJobResult);
		} catch (error) {
			port.postMessage({ index, error } satisfies DatasetJobResult);
		}
	},
);
