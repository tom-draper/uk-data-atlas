import type { BoundaryGeojson } from "@lib/types";
import { decodeBoundaryData } from "./decode";
import type { BoundaryGeometryFilter } from "./boundaries";
import type { BoundaryLocationRelations } from "./filter";

interface WorkerResponse {
	id: number;
	data?: unknown;
	error?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isWorkerResponse = (value: unknown): value is WorkerResponse =>
	isRecord(value) &&
	typeof value.id === "number" &&
	Number.isSafeInteger(value.id) &&
	value.id >= 0 &&
	(value.error === undefined
		? "data" in value
		: typeof value.error === "string" && !("data" in value));

type WorkerFilter = Omit<BoundaryGeometryFilter, "relations"> & {
	relations?: Omit<BoundaryLocationRelations, "getLadForWard">;
};

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<
	number,
	{ resolve: (data: BoundaryGeojson) => void; reject: (error: Error) => void }
>();

const getWorker = (): Worker | null => {
	if (typeof window === "undefined" || typeof Worker === "undefined") {
		return null;
	}
	if (worker) return worker;

	try {
		worker = new Worker(
			new URL("../../workers/boundary-worker.ts", import.meta.url),
		);
		worker.onmessage = (event: MessageEvent<unknown>) => {
			if (!isWorkerResponse(event.data)) {
				const error = new Error("Boundary worker returned an invalid response");
				for (const callbacks of pending.values()) callbacks.reject(error);
				pending.clear();
				worker?.terminate();
				worker = null;
				return;
			}
			const { id, data, error } = event.data;
			const callbacks = pending.get(id);
			if (!callbacks) return;
			pending.delete(id);
			if (error !== undefined) callbacks.reject(new Error(error));
			else {
				try {
					callbacks.resolve(decodeBoundaryData(data));
				} catch (reason) {
					callbacks.reject(
						reason instanceof Error
							? reason
							: new Error(String(reason)),
					);
				}
			}
		};
		worker.onerror = (event) => {
			const error = new Error(event.message || "Boundary worker error");
			for (const callbacks of pending.values()) callbacks.reject(error);
			pending.clear();
			worker = null;
		};
	} catch {
		worker = null;
	}

	return worker;
};

export const fetchBoundaryInWorker = (
	url: string,
	filter?: BoundaryGeometryFilter,
): Promise<BoundaryGeojson> | null => {
	const currentWorker = getWorker();
	if (!currentWorker) return null;

	return new Promise((resolve, reject) => {
		const id = nextRequestId++;
		pending.set(id, { resolve, reject });
		const workerFilter: WorkerFilter | undefined = filter
			? (() => {
					const { getLadForWard: _getLadForWard, ...relations } =
						filter.relations ?? {};
					return { ...filter, relations };
				})()
			: undefined;
		currentWorker.postMessage({
			id,
			url,
			filter: workerFilter,
		});
	});
};
