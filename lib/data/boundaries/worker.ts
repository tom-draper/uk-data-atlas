import type { BoundaryGeojson } from "@lib/types";

interface WorkerResponse {
	id: number;
	data?: BoundaryGeojson;
	error?: string;
}

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
		worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			const { id, data, error } = event.data;
			const callbacks = pending.get(id);
			if (!callbacks) return;
			pending.delete(id);
			if (error) callbacks.reject(new Error(error));
			else if (data) callbacks.resolve(data);
			else
				callbacks.reject(new Error("Boundary worker returned no data"));
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
): Promise<BoundaryGeojson> | null => {
	const currentWorker = getWorker();
	if (!currentWorker) return null;

	return new Promise((resolve, reject) => {
		const id = nextRequestId++;
		pending.set(id, { resolve, reject });
		currentWorker.postMessage({ id, url });
	});
};
