import { fork, type ChildProcess } from "node:child_process";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CrosswalkAdapter } from "./crosswalkAdapters";
import type { CrosswalkArtifact } from "./crosswalkCompiler";
import { readStoredText } from "./storedText";

export type CrosswalkDependency = { path: string; contentHash: string };
export type CrosswalkWork = {
	adapter: CrosswalkAdapter;
	pairs?: CrosswalkDependency;
};
export type CrosswalkWorkerResult =
	| { type: "ready" }
	| { type: "compiled"; id: string; contentHash: string; seconds: number }
	| { type: "failed"; id: string; message: string };

const GIB = 1024 ** 3;
/** Reserve 2 GiB for the parent and 6 GiB per worker, including a 4 GiB heap. */
export const crosswalkWorkerCount = (
	requested = process.env.CROSSWALK_WORKERS,
	memory = process.availableMemory(),
	cpus = availableParallelism(),
) => {
	const maximum = Math.max(
		1,
		Math.min(cpus, Math.floor((memory - 2 * GIB) / (6 * GIB))),
	);
	if (requested === undefined) return Math.min(2, maximum);
	if (
		!/^[1-9]\d*$/.test(requested) ||
		!Number.isSafeInteger(Number(requested))
	)
		throw new Error("CROSSWALK_WORKERS must be a positive integer.");
	const workers = Number(requested);
	if (workers > maximum)
		throw new Error(
			`CROSSWALK_WORKERS=${workers} exceeds the CPU/memory budget of ${maximum}. Each worker needs a 6 GiB budget plus 2 GiB for the parent.`,
		);
	return workers;
};

/** Each worker owns its caches and writes only the adapter assigned to it. */
export const compileCrosswalksInWorkers = async ({
	repositoryRoot,
	outputDirectory,
	adapters,
	prior = new Map(),
	workers,
	onCompiled,
}: {
	repositoryRoot: string;
	outputDirectory: string;
	adapters: CrosswalkAdapter[];
	prior?: ReadonlyMap<string, CrosswalkDependency>;
	workers: number;
	onCompiled: (artifact: CrosswalkArtifact, seconds: number) => void;
}): Promise<void> => {
	if (!Number.isSafeInteger(workers) || workers < 1)
		throw new Error("Crosswalk worker count must be a positive integer.");
	const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));
	if (byId.size !== adapters.length)
		throw new Error("Crosswalk worker tasks must have unique IDs.");
	for (const adapter of adapters) {
		if (adapter.method !== "population-overlap") continue;
		if (!byId.has(adapter.pairs) && !prior.has(adapter.pairs))
			throw new Error(
				`${adapter.id}: missing dependency ${adapter.pairs}.`,
			);
		const dependency = byId.get(adapter.pairs);
		if (dependency && dependency.method !== "area-overlap")
			throw new Error(
				`${adapter.id}: ${adapter.pairs} must be an area-overlap crosswalk.`,
			);
	}
	if (adapters.length === 0) return;
	const available = new Map([...prior].filter(([id]) => !byId.has(id)));
	const pending = [...adapters];
	const slots: Array<{
		child: ChildProcess;
		ready: boolean;
		task?: CrosswalkAdapter;
	}> = [];
	let settled = false;
	try {
		await new Promise<void>((resolve, reject) => {
			const fail = (error: Error) => {
				if (!settled) {
					settled = true;
					reject(error);
				}
			};
			const pump = () => {
				if (settled) return;
				try {
					for (const slot of slots) {
						if (!slot.ready || slot.task) continue;
						const index = pending.findIndex(
							(adapter) =>
								adapter.method !== "population-overlap" ||
								available.has(adapter.pairs),
						);
						if (index < 0) continue;
						const adapter = pending.splice(index, 1)[0]!;
						slot.task = adapter;
						const work: CrosswalkWork = { adapter };
						if (adapter.method === "population-overlap")
							work.pairs = available.get(adapter.pairs)!;
						slot.child.send(work, (error) => {
							if (error) fail(error);
						});
					}
					if (slots.every((slot) => slot.ready && !slot.task)) {
						if (pending.length)
							fail(
								new Error(
									"Crosswalk dependencies cannot be scheduled.",
								),
							);
						else {
							settled = true;
							resolve();
						}
					}
				} catch (error) {
					fail(
						error instanceof Error
							? error
							: new Error(String(error)),
					);
				}
			};
			for (
				let index = 0;
				index < Math.min(workers, adapters.length);
				index++
			) {
				const child = fork(
					fileURLToPath(
						new URL("./crosswalk-worker.ts", import.meta.url),
					),
					[repositoryRoot, outputDirectory],
					{
						execArgv: [
							"--max-old-space-size=4096",
							"--import",
							"tsx",
						],
						stdio: ["ignore", "inherit", "inherit", "ipc"],
					},
				);
				const slot: (typeof slots)[number] = { child, ready: false };
				slots.push(slot);
				child.on("error", fail);
				child.on("exit", (code, signal) => {
					if (!settled)
						fail(
							new Error(
								`Crosswalk worker exited (${signal ?? code})${slot.task ? ` compiling ${slot.task.id}` : ""}.`,
							),
						);
				});
				child.on("message", (message: CrosswalkWorkerResult) => {
					if (settled) return;
					try {
						if (message.type === "ready") {
							slot.ready = true;
							pump();
							return;
						}
						if (!slot.task || message.id !== slot.task.id)
							throw new Error(
								"Crosswalk worker returned an unexpected task.",
							);
						if (message.type === "failed")
							throw new Error(
								`${message.id}: ${message.message}`,
							);
						const path = join(
							outputDirectory,
							"crosswalks",
							`${message.id}.json`,
						);
						const artifact = JSON.parse(
							readStoredText(path),
						) as CrosswalkArtifact;
						if (
							artifact.id !== message.id ||
							artifact.contentHash !== message.contentHash
						)
							throw new Error(
								`Invalid worker artifact for ${message.id}.`,
							);
						onCompiled(artifact, message.seconds);
						available.set(message.id, {
							path,
							contentHash: message.contentHash,
						});
						slot.task = undefined;
						pump();
					} catch (error) {
						fail(
							error instanceof Error
								? error
								: new Error(String(error)),
						);
					}
				});
			}
		});
	} finally {
		settled = true;
		await Promise.all(
			slots.map(
				({ child }) =>
					new Promise<void>((resolve) => {
						if (
							!child.pid ||
							child.exitCode !== null ||
							child.signalCode !== null
						) {
							resolve();
							return;
						}
						const timer = setTimeout(
							() => child.kill("SIGKILL"),
							1000,
						);
						child.once("exit", () => {
							clearTimeout(timer);
							resolve();
						});
						child.kill("SIGTERM");
					}),
			),
		);
	}
};
