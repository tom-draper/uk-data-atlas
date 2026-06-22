"use client";
import { useState, useEffect, useRef } from "react";

interface WorkerRes { id: number; data?: unknown; error?: string }

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
	if (typeof window === "undefined") return null;
	if (!worker) {
		worker = new Worker(new URL("../workers/data-worker.ts", import.meta.url));
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

function fetchViaWorker(url: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const w = getWorker();
		if (!w) {
			// SSR fallback — should not be reached in practice
			fetch(url).then((r) => r.json()).then(resolve).catch(reject);
			return;
		}
		const id = nextId++;
		pending.set(id, { resolve, reject });
		w.postMessage({ id, url });
	});
}

export function useJsonDataLoader<T>(url: string, enabled = true) {
	const [datasets, setDatasets] = useState<Record<string, T>>({});
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState("");
	const loadedUrl = useRef<string | null>(null);

	useEffect(() => {
		if (!enabled) return;
		if (loadedUrl.current === url) return;
		loadedUrl.current = url;
		setError("");
		setLoading(true);

		fetchViaWorker(url)
			.then((data) => {
				setDatasets(data as Record<string, T>);
				setLoading(false);
			})
			.catch((err: Error) => {
				// Allow a future effect run to retry this URL
				if (loadedUrl.current === url) loadedUrl.current = null;
				setError(err.message);
				setLoading(false);
			});
	}, [enabled, url]);

	return { datasets, loading, error };
}
