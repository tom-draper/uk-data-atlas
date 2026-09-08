import {
	filterDatasetPayloadForLocation,
	type DatasetLocationFilter,
} from "../data/datasetLocationFilter";

interface Req {
	id: number;
	url: string;
	filter?: DatasetLocationFilter;
	chunkUrls?: readonly string[];
}

const mergePayloads = (payloads: unknown[]) => {
	const merged: Record<string, Record<string, unknown>> = {};
	for (const payload of payloads) {
		for (const [datasetId, dataset] of Object.entries(
			payload as Record<string, Record<string, unknown>>,
		)) {
			const existing = merged[datasetId];
			const data = dataset.data as Record<string, unknown> | undefined;
			if (!existing) {
				merged[datasetId] = {
					...dataset,
					...(data && { data: { ...data } }),
				};
				continue;
			}
			if (data) {
				const existingData = existing.data as Record<string, unknown>;
				existing.data = { ...existingData, ...data };
			}
		}
	}
	return merged;
};

const fetchJson = async (url: string) => {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`${response.status} ${response.statusText}`);
	return response.json();
};
interface Res {
	id: number;
	data?: unknown;
	error?: string;
}

self.addEventListener("message", async (e: MessageEvent<Req>) => {
	const { id, url, filter, chunkUrls } = e.data;
	try {
		let payload: unknown;
		try {
			payload =
				chunkUrls && chunkUrls.length > 0
					? mergePayloads(await Promise.all(chunkUrls.map(fetchJson)))
					: await fetchJson(url);
		} catch (chunkError) {
			if (!chunkUrls?.length) throw chunkError;
			console.warn(
				"[data] Region chunks unavailable; using the complete dataset:",
				chunkError,
			);
			payload = await fetchJson(url);
		}
		const data = await filterDatasetPayloadForLocation(payload, filter);
		(self as unknown as Worker).postMessage({ id, data } satisfies Res);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		(self as unknown as Worker).postMessage({
			id,
			error: msg,
		} satisfies Res);
	}
});
