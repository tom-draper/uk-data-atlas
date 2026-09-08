import {
	filterDatasetPayloadForLocation,
	type DatasetLocationFilter,
} from "../data/datasetLocationFilter";
import { mergeDatasetPayloads } from "../data/mergeDatasetPayloads";

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
					? mergeDatasetPayloads(
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
