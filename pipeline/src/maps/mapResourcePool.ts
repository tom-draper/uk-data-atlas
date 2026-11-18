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

const GIB = 1024 ** 3;

export function mapResourceConcurrency(
	available = process.availableMemory(),
	cpus = availableParallelism(),
	override = Number(process.env.ATLAS_MAP_RESOURCE_JOBS),
) {
	if (Number.isInteger(override) && override > 0) return override;
	return Math.max(
		1,
		Math.min(4, cpus - 1, Math.floor((available - 2 * GIB) / (2 * GIB))),
	);
}

export function mapResourceMemoryBudget(
	available = process.availableMemory(),
	override = Number(process.env.ATLAS_MAP_RESOURCE_JOBS),
) {
	if (Number.isInteger(override) && override > 0) return Infinity;
	return Math.max(4 * GIB, available - 2 * GIB);
}

export async function runMapResourceJobs(
	jobs: Job[],
	size: number,
	workerUrl = new URL("./mapResourceWorker.ts", import.meta.url),
	onResult: (index: number, result: Result) => void = () => {},
	budget = Infinity,
): Promise<Result[]> {
	if (!jobs.length) return [];
	const results: Result[] = new Array(jobs.length);
	const workers: Worker[] = [];
	const remaining = new Set(jobs.map((_, i) => i));
	let activeLarge = false;
	let activeMemory = 0;
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
						(i) =>
							(!jobs[i]!.large || !activeLarge) &&
							activeMemory + (jobs[i]!.large ? 4 : 2) * GIB <=
								budget,
					);
					if (index === undefined) continue;
					remaining.delete(index);
					active.set(worker, index);
					activeMemory += (jobs[index]!.large ? 4 : 2) * GIB;
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
						activeMemory -= (jobs[index]!.large ? 4 : 2) * GIB;
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
