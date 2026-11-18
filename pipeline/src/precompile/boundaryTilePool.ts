import { Worker } from "node:worker_threads";
import type { BoundaryResource } from "@uk-data-atlas/areas";
import { compileBoundaryRelease } from "./compileBoundaryTiles.ts";

type Job = { label: string; asset: string };
type Result = { entry: BoundaryResource; bytes: Uint8Array };
type Message =
	{ index: number; result: Result } | { index: number; error: string };

/** Stage results as they arrive, but leave publication to the caller. */
export async function runBoundaryTileJobs(
	jobs: readonly Job[],
	size: number,
	stage: (index: number, result: Result) => Promise<void>,
	workerUrl = new URL("./boundaryTileWorker.ts", import.meta.url),
) {
	if (size <= 1) {
		for (const [index, job] of jobs.entries()) {
			try {
				await stage(
					index,
					await compileBoundaryRelease(job.label, job.asset),
				);
			} catch (error) {
				throw new Error(
					`Boundary tile ${job.label} failed: ${String(error)}`,
					{ cause: error },
				);
			}
		}
		return;
	}
	const workers: Worker[] = [];
	const pending = new Set<Promise<void>>();
	let next = 0;
	let completed = 0;
	let settled = false;
	try {
		await new Promise<void>((resolve, reject) => {
			const fail = (error: Error) => {
				if (settled) return;
				settled = true;
				reject(error);
			};
			const dispatch = (worker: Worker) => {
				if (settled || next >= jobs.length) return;
				const index = next++;
				worker.postMessage({ index, ...jobs[index] });
			};
			for (let i = 0; i < size; i++) {
				const worker = new Worker(workerUrl, {
					resourceLimits: { maxOldGenerationSizeMb: 3072 },
				});
				workers.push(worker);
				worker.on("error", (error) =>
					fail(
						new Error(
							`Boundary tile worker failed: ${String(error)}`,
							{ cause: error },
						),
					),
				);
				worker.on("exit", (code) =>
					fail(
						new Error(
							`Boundary tile worker stopped early (${code}).`,
						),
					),
				);
				worker.on("message", (message: Message) => {
					if (settled) return;
					if ("error" in message)
						return fail(
							new Error(
								`Boundary tile ${jobs[message.index]?.label} failed: ${message.error}`,
							),
						);
					const task = stage(message.index, message.result);
					pending.add(task);
					void task.then(
						() => {
							pending.delete(task);
							if (settled) return;
							if (++completed === jobs.length) {
								settled = true;
								resolve();
							} else dispatch(worker);
						},
						(error: unknown) => {
							pending.delete(task);
							fail(
								new Error(
									`Staging boundary tile ${jobs[message.index]?.label} failed: ${String(error)}`,
									{ cause: error },
								),
							);
						},
					);
				});
				dispatch(worker);
			}
		});
	} finally {
		settled = true;
		await Promise.all(workers.map((worker) => worker.terminate()));
		await Promise.allSettled(pending);
	}
}
