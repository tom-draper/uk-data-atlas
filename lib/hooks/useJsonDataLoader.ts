"use client";
import { useState, useEffect, useRef } from "react";

interface WorkerRes { id: number; data?: unknown; error?: string }

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

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
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

function fetchViaWorker(url: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const w = getWorker();
		if (!w) {
			fetchJson(url).then(resolve).catch(reject);
			return;
		}
		const id = nextId++;
		pending.set(id, { resolve, reject });
		try {
			w.postMessage({ id, url });
		} catch (error) {
			pending.delete(id);
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
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
		loadedUrl.current = url;
		setError("");
		setLoading(true);

		fetchViaWorker(url)
			.then((data) => {
				if (!active || loadedUrl.current !== url) return;
				setDatasets(data as Record<string, T>);
				setLoading(false);
			})
			.catch((err: Error) => {
				if (!active || loadedUrl.current !== url) return;
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
