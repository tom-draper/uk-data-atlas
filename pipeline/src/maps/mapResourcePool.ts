import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import type { BoundaryReleaseSummary } from "./compileMapResource.ts";
import type { MapResourceDescriptor } from "@uk-data-atlas/map-tiles";

export type Unavailable = {
	geography: string;
	boundaryRelease: string;
	reason: string;
	features?: MapResourceDescriptor["features"];
};
export type Job = {
	root: string;
	release: BoundaryReleaseSummary;
	names: [string, string][];
	artifact: string;
	path: string;
	large: boolean;
};
export type Result =
	{ descriptor: MapResourceDescriptor } | { unavailable: Unavailable };

export function mapResourceConcurrency() {
	const requested = Number(process.env.ATLAS_MAP_RESOURCE_JOBS);
	if (Number.isInteger(requested) && requested > 0) return requested;
	return Math.max(
		1,
		Math.min(
			4,
			availableParallelism() - 1,
			Math.floor(
				(process.availableMemory() - 2 * 1024 ** 3) / (4 * 1024 ** 3),
			),
		),
	);
}

export async function runMapResourceJobs(
	jobs: Job[],
	size: number,
	workerUrl = new URL("./mapResourceWorker.ts", import.meta.url),
	onResult: (index: number, result: Result) => void = () => {},
): Promise<Result[]> {
	if (!jobs.length) return [];
	const results: Result[] = new Array(jobs.length);
	const workers: Worker[] = [];
	const remaining = new Set(jobs.map((_, i) => i));
	let activeLarge = false;
	let completed = 0;
	let settled = false;
	try {
		await new Promise<void>((resolve, reject) => {
			const active = new Map<Worker, number>();
			const fail = (index: number | undefined, error: unknown) => {
				if (settled) return;
				settled = true;
				const release =
					index === undefined
						? "unknown release"
						: `${jobs[index]!.release.geography}/${jobs[index]!.release.id}`;
				reject(
					new Error(
						`Map resource ${release} worker failed: ${String(error)}`,
					),
				);
			};
			const dispatch = () => {
				for (const worker of workers) {
					if (active.has(worker)) continue;
					const index = [...remaining].find(
						(i) => !jobs[i]!.large || !activeLarge,
					);
					if (index === undefined) continue;
					remaining.delete(index);
					active.set(worker, index);
					if (jobs[index]!.large) activeLarge = true;
					worker.postMessage({ index, ...jobs[index] });
				}
			};
			for (let i = 0; i < Math.min(size, jobs.length); i++) {
				const worker = new Worker(workerUrl, {
					resourceLimits: { maxOldGenerationSizeMb: 3072 },
				});
				workers.push(worker);
				worker.on("error", (error) => fail(active.get(worker), error));
				worker.on("exit", (code) => {
					if (!settled)
						fail(active.get(worker), `stopped early (${code})`);
				});
				worker.on(
					"message",
					(
						message: {
							index: number;
							error?: string;
						} & Partial<Result>,
					) => {
						if (settled) return;
						const index = active.get(worker);
						if (index === undefined || index !== message.index)
							return fail(index, "invalid worker response");
						if (message.error) return fail(index, message.error);
						if (
							!("descriptor" in message) &&
							!("unavailable" in message)
						)
							return fail(index, "missing worker result");
						results[index] = message as Result;
						try {
							onResult(index, results[index]!);
						} catch (error) {
							return fail(index, error);
						}
						active.delete(worker);
						if (jobs[index]!.large) activeLarge = false;
						if (++completed === jobs.length) {
							settled = true;
							resolve();
						} else dispatch();
					},
				);
			}
			dispatch();
		});
		return results;
	} finally {
		settled = true;
		await Promise.all(workers.map((worker) => worker.terminate()));
	}
}
