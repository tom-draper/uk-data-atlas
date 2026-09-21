"use client";

import { useEffect, useRef, useState } from "react";
import {
	loadJsonDataset,
	loadJsonDatasetSlice,
	type JsonDatasetRequest,
} from "../data/jsonDatasetClient";

export type { JsonDatasetRequest } from "../data/jsonDatasetClient";

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
		const controller = new AbortController();
		const pendingRequests = requests.filter((request) => request.enabled);
		if (pendingRequests.length === 0) {
			setLoading(false);
			return;
		}
		setLoading(true);
		loadJsonDatasetSlice<T>(requests, requestKey, controller.signal).then(
			(slice) => {
				if (controller.signal.aborted) return;
				setDatasets(slice.datasets);
				setErrors(slice.errors);
				setLoading(false);
			},
		);
		return () => controller.abort();
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
		const controller = new AbortController();
		if (!enabled) {
			setLoading(false);
			return () => {
				active = false;
				controller.abort();
			};
		}
		if (loadedUrl.current === url) return;
		setError("");
		setLoading(true);

		loadJsonDataset(url, controller.signal)
			.then((data) => {
				if (!active) return;
				loadedUrl.current = url;
				setDatasets(data as Record<string, T>);
				setLoading(false);
			})
			.catch((err: Error) => {
				if (!active) return;
				if (loadedUrl.current === url) loadedUrl.current = null;
				setError(err.message);
				setLoading(false);
			});

		return () => {
			active = false;
			controller.abort();
		};
	}, [enabled, url]);

	return { datasets, loading, error };
}
