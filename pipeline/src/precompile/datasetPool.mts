import { datasetConcurrency } from "./datasetConcurrency.mjs";
import { Worker } from "worker_threads";
import {
	compileStaleDataset,
	readCompiledFromDisk,
	reuseDataset,
} from "./compileDataset.mts";
import type { DatasetJob, DatasetJobResult } from "./datasetWorker.mts";
import type {
	CatalogueDefinition,
	CompiledDatasets,
	ReuseContext,
} from "./types.mts";

type ManifestEntry = Awaited<ReturnType<typeof compileStaleDataset>>;

// Matches the heap the precompile scripts give the main thread.
const WORKER_HEAP_MB = 3072;

/** Runs every job on a pool of `size` workers. Rejects on the first failure. */
const runJobs = (jobs: readonly DatasetJob[], size: number) =>
	new Promise<Map<number, ManifestEntry>>((resolve, reject) => {
		const entries = new Map<number, ManifestEntry>();
		const workers: Worker[] = [];
		let next = 0;
		let settled = false;
		const settle = (error?: unknown) => {
			if (settled) return;
			settled = true;
			for (const worker of workers) void worker.terminate();
			if (error === undefined) resolve(entries);
			else reject(error);
		};
		const dispatch = (worker: Worker) => {
			const job = jobs[next++];
			if (job) worker.postMessage(job);
		};
		for (let started = 0; started < size; started++) {
			const worker = new Worker(
				new URL("./datasetWorker.mts", import.meta.url),
				{ resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB } },
			);
			workers.push(worker);
			worker.on("message", (result: DatasetJobResult) => {
				if ("error" in result) return settle(result.error);
				entries.set(result.index, JSON.parse(result.entry));
				if (entries.size === jobs.length) settle();
				else dispatch(worker);
			});
			worker.on("error", settle);
			worker.on("exit", (code) =>
				settle(new Error(`A dataset worker stopped early (${code}).`)),
			);
			dispatch(worker);
		}
	});

/**
 * Compiles every dataset, reusing those an earlier run left current. Returns
 * their manifest entries in the order of `definitions`.
 *
 * Datasets are independent of each other, so the stale ones are spread over
 * worker threads. Each worker runs one loader at a time, which keeps the peak
 * at the largest few datasets rather than all of them at once.
 */
export async function compileDatasets(
	definitions: readonly CatalogueDefinition[],
	compiledDatasets: CompiledDatasets,
	reuse: ReuseContext,
): Promise<ManifestEntry[]> {
	const entries: (ManifestEntry | undefined)[] = [];
	const jobs: DatasetJob[] = [];
	for (const [index, definition] of definitions.entries()) {
		entries[index] = await reuseDataset(
			definition,
			compiledDatasets,
			reuse,
		);
		if (!entries[index])
			jobs.push({
				index,
				type: definition.type,
				existing: reuse.existingDatasets.get(definition.type),
				fingerprint: reuse.datasetFingerprints[definition.type],
			});
	}

	const size = Math.min(datasetConcurrency(), jobs.length);
	// A worker has to load the catalogue before it can compile anything, which
	// is not worth it for a single dataset.
	if (size <= 1) {
		for (const { index, existing, fingerprint } of jobs)
			entries[index] = await compileStaleDataset(
				definitions[index]!,
				compiledDatasets,
				existing,
				fingerprint,
			);
	} else {
		for (const [index, entry] of await runJobs(jobs, size)) {
			entries[index] = entry;
			readCompiledFromDisk(definitions[index]!, compiledDatasets);
		}
	}
	return entries as ManifestEntry[];
}
