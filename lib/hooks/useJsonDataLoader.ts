"use client";
import { useState, useEffect, useRef } from "react";
import type { DatasetLocationFilter } from "../data/datasetLocationFilter";

interface WorkerRes {
	id: number;
	data?: unknown;
	error?: string;
}

let worker: Worker | null = null;
let nextId = 0;
type PendingRequest = {
	resolve: (v: unknown) => void;
	reject: (e: Error) => void;
	signal?: AbortSignal;
	onAbort?: () => void;
};
const pending = new Map<number, PendingRequest>();
const SLICE_CACHE_LIMIT = 3;

type CachedSlice<T> = {
	datasets: Record<string, Record<string, T>>;
	errors: string[];
};

// A location slice contains every enabled dataset for one view. Retaining a
// few whole slices makes back-and-forth navigation instant without allowing
// the many individual dataset responses to grow without bound.
const completedSlices = new Map<string, CachedSlice<unknown>>();

const abortError = () => new DOMException("Request cancelled", "AbortError");

const removeAbortListener = (entry: PendingRequest) => {
	if (entry.signal && entry.onAbort)
		entry.signal.removeEventListener("abort", entry.onAbort);
};

const rememberSlice = <T>(key: string, slice: CachedSlice<T>) => {
	completedSlices.delete(key);
	completedSlices.set(key, slice as CachedSlice<unknown>);
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
		worker.onmessage = (e: MessageEvent<WorkerRes>) => {
			const { id, data, error } = e.data;
			const callbacks = pending.get(id);
			if (!callbacks) return;
			pending.delete(id);
			removeAbortListener(callbacks);
			if (error) callbacks.reject(new Error(error));
			else callbacks.resolve(data);
		};
		worker.onerror = (e) => {
			console.error("Data worker error:", e.message);
			const err = new Error(e.message ?? "Worker error");
			for (const callbacks of pending.values()) {
				removeAbortListener(callbacks);
				callbacks.reject(err);
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
		const w = getWorker();
		if (!w) {
			fetchJson(url, signal).then(resolve).catch(reject);
			return;
		}
		const id = nextId++;
		const onAbort = () => {
			if (!pending.has(id)) return;
			pending.delete(id);
			w.postMessage({ type: "cancel", id });
			reject(abortError());
		};
		pending.set(id, { resolve, reject, signal, onAbort });
		signal?.addEventListener("abort", onAbort, { once: true });
		try {
			w.postMessage({ id, url, filter, chunkUrls });
		} catch (error) {
			const callbacks = pending.get(id);
			pending.delete(id);
			if (callbacks) removeAbortListener(callbacks);
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
}

export interface JsonDatasetRequest {
	key: string;
	url: string;
	enabled: boolean;
	filter?: DatasetLocationFilter;
	chunkUrls?: readonly string[];
}

export function useJsonDatasetLoaders<T>(
	requests: readonly JsonDatasetRequest[],
) {
	const [datasets, setDatasets] = useState<Record<string, Record<string, T>>>(
		{},
	);
	const [loading, setLoading] = useState(
		requests.some((request) => request.enabled),
	);
	const [errors, setErrors] = useState<string[]>([]);
	const requestKey = requests
		.map(
			(request) =>
				`${request.key}:${request.url}:${request.enabled}:${request.filter?.location ?? ""}:${request.filter?.boundaryType ?? ""}:${JSON.stringify(request.filter?.payloadLayout ?? {})}:${request.filter?.includeLocationPopulationSummary ?? false}:${request.chunkUrls?.join(",") ?? ""}`,
		)
		.join("|");

	useEffect(() => {
		const cached = completedSlices.get(requestKey) as
			CachedSlice<T> | undefined;
		if (cached) {
			completedSlices.delete(requestKey);
			completedSlices.set(requestKey, cached as CachedSlice<unknown>);
			setDatasets(cached.datasets);
			setErrors(cached.errors);
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		const pendingRequests = requests.filter((request) => request.enabled);
		if (pendingRequests.length === 0) {
			setLoading(false);
			return;
		}
		setLoading(true);
		Promise.allSettled(
			pendingRequests.map(async (request) => ({
				key: request.key,
				url: request.url,
				filter: request.filter,
				chunkUrls: request.chunkUrls,
				data: (await fetchViaWorker(
					request.url,
					request.filter,
					request.chunkUrls,
					controller.signal,
				)) as Record<string, T>,
			})),
		).then((results) => {
			if (controller.signal.aborted) return;
			const loaded: Record<string, Record<string, T>> = {};
			const nextErrors: string[] = [];
			for (const result of results) {
				if (result.status === "fulfilled") {
					loaded[result.value.key] = result.value.data;
				} else
					nextErrors.push(
						result.reason instanceof Error
							? result.reason.message
							: String(result.reason),
					);
			}
			const slice = { datasets: loaded, errors: nextErrors };
			rememberSlice(requestKey, slice);
			setDatasets(loaded);
			setErrors(nextErrors);
			setLoading(false);
		});
		return () => {
			controller.abort();
		};
	}, [requestKey]);

	return { datasets, loading, errors };
}

export function useJsonDataLoader<T>(url: string, enabled = true) {
	const [datasets, setDatasets] = useState<Record<string, T>>({});
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState("");
	const loadedUrl = useRef<string | null>(null);

	useEffect(() => {
		let active = true;
		if (!enabled) {
			setLoading(false);
			return () => {
				active = false;
			};
		}
		if (loadedUrl.current === url) return;
		setError("");
		setLoading(true);

		fetchViaWorker(url)
			.then((data) => {
				if (!active) return;
				loadedUrl.current = url;
				setDatasets(data as Record<string, T>);
				setLoading(false);
			})
			.catch((err: Error) => {
				if (!active) return;
				// Allow a future effect run to retry this URL
				if (loadedUrl.current === url) loadedUrl.current = null;
				setError(err.message);
				setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [enabled, url]);

	return { datasets, loading, error };
}
