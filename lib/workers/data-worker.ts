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

interface CancelReq {
	type: "cancel";
	id: number;
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

const controllers = new Map<number, AbortController>();

const fetchJson = async (url: string, signal?: AbortSignal) => {
	const response = await fetch(url, { signal });
	if (!response.ok)
		throw new Error(`${response.status} ${response.statusText}`);
	return response.json();
};
interface Res {
	id: number;
	data?: unknown;
	error?: string;
}

const isAbortError = (error: unknown) =>
	error instanceof DOMException && error.name === "AbortError";

self.addEventListener("message", async (e: MessageEvent<Req | CancelReq>) => {
	if ("type" in e.data && e.data.type === "cancel") {
		controllers.get(e.data.id)?.abort();
		return;
	}
	const { id, url, filter, chunkUrls } = e.data as Req;
	const controller = new AbortController();
	controllers.set(id, controller);
	try {
		let payload: unknown;
		try {
			payload =
				chunkUrls && chunkUrls.length > 0
					? mergePayloads(
							await Promise.all(
								chunkUrls.map((chunkUrl) =>
									fetchJson(chunkUrl, controller.signal),
								),
							),
						)
					: await fetchJson(url, controller.signal);
		} catch (chunkError) {
			if (isAbortError(chunkError)) throw chunkError;
			if (!chunkUrls?.length) throw chunkError;
			console.warn(
				"[data] Region chunks unavailable; using the complete dataset:",
				chunkError,
			);
			payload = await fetchJson(url, controller.signal);
		}
		const data = await filterDatasetPayloadForLocation(payload, filter);
		if (controller.signal.aborted) return;
		(self as unknown as Worker).postMessage({ id, data } satisfies Res);
	} catch (err: unknown) {
		if (isAbortError(err)) return;
		const msg = err instanceof Error ? err.message : String(err);
		(self as unknown as Worker).postMessage({
			id,
			error: msg,
		} satisfies Res);
	} finally {
		controllers.delete(id);
	}
});
