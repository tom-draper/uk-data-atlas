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
const pending = new Map<
	number,
	{ resolve: (v: unknown) => void; reject: (e: Error) => void }
>();
const pendingFetches = new Map<string, Promise<unknown>>();

const requestCacheKey = (url: string, filter?: DatasetLocationFilter) =>
	`${url}\u0000${filter?.location ?? ""}\u0000${filter?.boundaryType ?? ""}`;

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
			if (error) callbacks.reject(new Error(error));
			else callbacks.resolve(data);
		};
		worker.onerror = (e) => {
			console.error("Data worker error:", e.message);
			const err = new Error(e.message ?? "Worker error");
			for (const callbacks of pending.values()) callbacks.reject(err);
			pending.clear();
			worker = null;
		};
	}
	return worker;
}

async function fetchJson(url: string): Promise<unknown> {
	const response = await fetch(url);
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
): Promise<unknown> {
	const cacheKey = requestCacheKey(url, filter);
	const existing = pendingFetches.get(cacheKey);
	if (existing) return existing;

	const request = new Promise<unknown>((resolve, reject) => {
		const w = getWorker();
		if (!w) {
			fetchJson(url).then(resolve).catch(reject);
			return;
		}
		const id = nextId++;
		pending.set(id, { resolve, reject });
		try {
			w.postMessage({ id, url, filter });
		} catch (error) {
			pending.delete(id);
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
	pendingFetches.set(cacheKey, request);
	request.then(
		() => pendingFetches.delete(cacheKey),
		() => pendingFetches.delete(cacheKey),
	);
	return request;
}

export interface JsonDatasetRequest {
	key: string;
	url: string;
	enabled: boolean;
	filter?: DatasetLocationFilter;
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
	const loadedRequests = useRef(new Set<string>());
	const requestKey = requests
		.map(
			(request) =>
				`${request.key}:${request.url}:${request.enabled}:${request.filter?.location ?? ""}:${request.filter?.boundaryType ?? ""}`,
		)
		.join("|");

	useEffect(() => {
		let active = true;
		const pendingRequests = requests.filter(
			(request) =>
				request.enabled &&
				!loadedRequests.current.has(
					requestCacheKey(request.url, request.filter),
				),
		);
		if (pendingRequests.length === 0) {
			setLoading(false);
			return () => {
				active = false;
			};
		}
		setLoading(true);
		Promise.allSettled(
			pendingRequests.map(async (request) => ({
				key: request.key,
				url: request.url,
				filter: request.filter,
				data: (await fetchViaWorker(
					request.url,
					request.filter,
				)) as Record<string, T>,
			})),
		).then((results) => {
			if (!active) return;
			const loaded: Record<string, Record<string, T>> = {};
			const nextErrors: string[] = [];
			for (const result of results) {
				if (result.status === "fulfilled") {
					loaded[result.value.key] = result.value.data;
					loadedRequests.current.add(
						requestCacheKey(result.value.url, result.value.filter),
					);
				} else
					nextErrors.push(
						result.reason instanceof Error
							? result.reason.message
							: String(result.reason),
					);
			}
			setDatasets((current) => ({ ...current, ...loaded }));
			setErrors(nextErrors);
			setLoading(false);
		});
		return () => {
			active = false;
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
