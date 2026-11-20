"use client";

import { useEffect, useRef, useState } from "react";
import {
	loadJsonDataset,
	loadJsonDatasetSlice,
	parseJsonDatasetRecord,
	type JsonDatasetParser,
	type JsonDatasetRequest,
} from "../data/jsonDatasetClient";

export type { JsonDatasetRequest } from "../data/jsonDatasetClient";

export function useJsonDatasetLoaders<T>(
	requests: readonly JsonDatasetRequest[],
	parseDataset: JsonDatasetParser<T>,
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
		// Show each dataset as it lands, so cards need not wait for the
		// slowest one. Arrivals within a frame render together.
		let arrived: Record<string, Record<string, T>> = {};
		let frame: number | null = null;
		const publish = () => {
			frame = null;
			const batch = arrived;
			arrived = {};
			setDatasets((current) => ({ ...current, ...batch }));
		};
		loadJsonDatasetSlice<T>(
			requests,
			controller.signal,
			parseDataset,
			(key, data) => {
				arrived[key] = data;
				frame ??= requestAnimationFrame(publish);
			},
		).then((slice) => {
			if (frame !== null) cancelAnimationFrame(frame);
			if (controller.signal.aborted) return;
			setDatasets(slice.datasets);
			setErrors(slice.errors);
			setLoading(false);
		});
		return () => {
			if (frame !== null) cancelAnimationFrame(frame);
			controller.abort();
		};
	}, [requestKey, parseDataset]);

	return { datasets, loading, errors };
}

export type { JsonDatasetParser } from "../data/jsonDatasetClient";

export function useJsonDataLoader<T>(
	url: string,
	parseDataset: JsonDatasetParser<T>,
	enabled = true,
) {
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
				const parsedDatasets = parseJsonDatasetRecord(
					data,
					parseDataset,
				);
				loadedUrl.current = url;
				setDatasets(parsedDatasets);
				setLoading(false);
			})
			.catch((reason: unknown) => {
				if (!active) return;
				if (loadedUrl.current === url) loadedUrl.current = null;
				setError(
					reason instanceof Error ? reason.message : String(reason),
				);
				setLoading(false);
			});

		return () => {
			active = false;
			controller.abort();
		};
	}, [enabled, parseDataset, url]);

	return { datasets, loading, error };
}
