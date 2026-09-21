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
	filter?: DatasetLocationFilter;
	chunkUrls?: readonly string[];
};

export type CachedDatasetSlice<T> = {
	datasets: Record<string, Record<string, T>>;
	errors: string[];
};

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, PendingRequest>();
const SLICE_CACHE_LIMIT = 3;
const completedSlices = new Map<string, CachedDatasetSlice<unknown>>();

const abortError = () => new DOMException("Request cancelled", "AbortError");

const removeAbortListener = (entry: PendingRequest) => {
	if (entry.signal && entry.onAbort)
		entry.signal.removeEventListener("abort", entry.onAbort);
};

const rememberSlice = <T>(key: string, slice: CachedDatasetSlice<T>) => {
	completedSlices.delete(key);
	completedSlices.set(key, slice as CachedDatasetSlice<unknown>);
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
		worker.onmessage = (event: MessageEvent<WorkerRes>) => {
			const { id, data, error } = event.data;
			const callbacks = pending.get(id);
			if (!callbacks) return;
			pending.delete(id);
			removeAbortListener(callbacks);
			if (error) callbacks.reject(new Error(error));
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
): Promise<CachedDatasetSlice<T>> {
	const cached = completedSlices.get(requestKey) as
		CachedDatasetSlice<T> | undefined;
	if (cached) {
		completedSlices.delete(requestKey);
		completedSlices.set(requestKey, cached as CachedDatasetSlice<unknown>);
		return cached;
	}

	const pendingRequests = requests.filter((request) => request.enabled);
	const results = await Promise.allSettled(
		pendingRequests.map(async (request) => ({
			key: request.key,
			data: (await fetchViaWorker(
				request.url,
				request.filter,
				request.chunkUrls,
				signal,
			)) as Record<string, T>,
		})),
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
