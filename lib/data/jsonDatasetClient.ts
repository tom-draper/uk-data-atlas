import type { DatasetLocationFilter } from "../data/datasetLocationFilter";

interface WorkerRes {
	id: number;
	data?: unknown;
	error?: string;
}

type PendingRequest = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	signal?: AbortSignal;
	onAbort?: () => void;
};

export type JsonDatasetRequest = {
	key: string;
	url: string;
	enabled: boolean;
	/** Lower values start first when the bounded loader opens a slot. */
	priority?: number;
	filter?: DatasetLocationFilter;
	chunkUrls?: readonly string[];
};

export type CachedDatasetSlice<T> = {
	datasets: Record<string, Record<string, T>>;
	errors: string[];
};

export type JsonDatasetParser<T> = (
	value: unknown,
	datasetGroup?: string,
) => T;

export const parseJsonDatasetRecord = <T>(
	value: unknown,
	parseDataset: JsonDatasetParser<T>,
	datasetGroup?: string,
): Record<string, T> => {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new Error("Expected a JSON object containing datasets.");

	return Object.fromEntries(
		Object.entries(value).map(([id, dataset]) => [
			id,
			parseDataset(dataset, datasetGroup),
		]),
	);
};

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, PendingRequest>();
const SLICE_CACHE_LIMIT = 3;
const MAX_CONCURRENT_DATASET_REQUESTS = 4;
const completedSlices = new Map<string, CachedDatasetSlice<unknown>>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isWorkerResponse = (value: unknown): value is WorkerRes =>
	isRecord(value) &&
	typeof value.id === "number" &&
	Number.isSafeInteger(value.id) &&
	value.id >= 0 &&
	(value.error === undefined
		? "data" in value
		: typeof value.error === "string" && !("data" in value));

const abortError = () => new DOMException("Request cancelled", "AbortError");

const removeAbortListener = (entry: PendingRequest) => {
	if (entry.signal && entry.onAbort)
		entry.signal.removeEventListener("abort", entry.onAbort);
};

const rememberSlice = <T>(key: string, slice: CachedDatasetSlice<T>) => {
	completedSlices.delete(key);
	completedSlices.set(key, slice);
	if (completedSlices.size > SLICE_CACHE_LIMIT) {
		const oldest = completedSlices.keys().next().value;
		if (oldest !== undefined) completedSlices.delete(oldest);
	}
};

function getWorker(): Worker | null {
	if (typeof window === "undefined" || typeof Worker === "undefined")
		return null;
	if (!worker) {
		try {
			worker = new Worker(
				new URL("../workers/data-worker.ts", import.meta.url),
			);
		} catch {
			return null;
		}
		worker.onmessage = (event: MessageEvent<unknown>) => {
			if (!isWorkerResponse(event.data)) {
				const error = new Error("Data worker returned an invalid response");
				for (const callbacks of pending.values()) {
					removeAbortListener(callbacks);
					callbacks.reject(error);
				}
				pending.clear();
				worker?.terminate();
				worker = null;
				return;
			}
			const { id, data, error } = event.data;
			const callbacks = pending.get(id);
			if (!callbacks) return;
			pending.delete(id);
			removeAbortListener(callbacks);
			if (error !== undefined) callbacks.reject(new Error(error));
			else callbacks.resolve(data);
		};
		worker.onerror = (event) => {
			console.error("Data worker error:", event.message);
			const error = new Error(event.message ?? "Worker error");
			for (const callbacks of pending.values()) {
				removeAbortListener(callbacks);
				callbacks.reject(error);
			}
			pending.clear();
			worker = null;
		};
	}
	return worker;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${response.status} ${response.statusText}`,
		);
	}
	return response.json();
}

function fetchViaWorker(
	url: string,
	filter?: DatasetLocationFilter,
	chunkUrls?: readonly string[],
	signal?: AbortSignal,
): Promise<unknown> {
	return new Promise<unknown>((resolve, reject) => {
		if (signal?.aborted) {
			reject(abortError());
			return;
		}
		const currentWorker = getWorker();
		if (!currentWorker) {
			fetchJson(url, signal).then(resolve).catch(reject);
			return;
		}
		const id = nextId++;
		const onAbort = () => {
			if (!pending.has(id)) return;
			pending.delete(id);
			currentWorker.postMessage({ type: "cancel", id });
			reject(abortError());
		};
		pending.set(id, { resolve, reject, signal, onAbort });
		signal?.addEventListener("abort", onAbort, { once: true });
		try {
			currentWorker.postMessage({ id, url, filter, chunkUrls });
		} catch (error) {
			const callbacks = pending.get(id);
			pending.delete(id);
			if (callbacks) removeAbortListener(callbacks);
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
}

export function loadJsonDataset(
	url: string,
	signal?: AbortSignal,
): Promise<unknown> {
	return fetchViaWorker(url, undefined, undefined, signal);
}

/** Load one enabled dataset slice, using the worker and bounded LRU cache. */
export async function loadJsonDatasetSlice<T>(
	requests: readonly JsonDatasetRequest[],
	requestKey: string,
	signal: AbortSignal,
	parseDataset: JsonDatasetParser<T>,
): Promise<CachedDatasetSlice<T>> {
	const cached = completedSlices.get(requestKey);
	if (cached) {
		completedSlices.delete(requestKey);
		completedSlices.set(requestKey, cached);
		return {
			datasets: Object.fromEntries(
				Object.entries(cached.datasets).map(([group, records]) => [
					group,
					parseJsonDatasetRecord(records, parseDataset, group),
				]),
			),
			errors: cached.errors,
		};
	}

	const pendingRequests = requests
		.map((request, index) => ({ request, index }))
		.filter(({ request }) => request.enabled)
		.sort(
			(left, right) =>
				(left.request.priority ?? 0) - (right.request.priority ?? 0),
		);
	const results = new Array<
		PromiseSettledResult<{ key: string; data: Record<string, T> }>
	>(pendingRequests.length);
	let nextRequest = 0;
	const runNext = async () => {
		while (nextRequest < pendingRequests.length) {
			const slot = nextRequest++;
			const request = pendingRequests[slot]!.request;
			try {
				results[slot] = {
					status: "fulfilled",
					value: {
						key: request.key,
						data: parseJsonDatasetRecord(
							await fetchViaWorker(
								request.url,
								request.filter,
								request.chunkUrls,
								signal,
							),
							parseDataset,
							request.key,
						),
					},
				};
			} catch (reason) {
				results[slot] = { status: "rejected", reason };
			}
		}
	};
	await Promise.all(
		Array.from(
			{
				length: Math.min(
					MAX_CONCURRENT_DATASET_REQUESTS,
					pendingRequests.length,
				),
			},
			() => runNext(),
		),
	);
	const loaded: Record<string, Record<string, T>> = {};
	const errors: string[] = [];
	for (const result of results) {
		if (result.status === "fulfilled")
			loaded[result.value.key] = result.value.data;
		else
			errors.push(
				result.reason instanceof Error
					? result.reason.message
					: String(result.reason),
			);
	}
	const slice = { datasets: loaded, errors };
	if (!signal.aborted) rememberSlice(requestKey, slice);
	return slice;
}
