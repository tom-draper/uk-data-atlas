import {
	filterDatasetPayloadForLocation,
	type DatasetLocationFilter,
} from "../data/datasetLocationFilter";
import { mergeDatasetPayloads } from "../data/mergeDatasetPayloads";
import { BOUNDARY_TYPES } from "../data/boundaries/catalog";

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

const BOUNDARY_TYPE_SET = new Set<string>(BOUNDARY_TYPES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isDatasetLocationFilter = (
	value: unknown,
): value is DatasetLocationFilter =>
	isRecord(value) &&
	typeof value.location === "string" &&
	typeof value.boundaryType === "string" &&
	BOUNDARY_TYPE_SET.has(value.boundaryType) &&
	(value.payloadLayout === undefined || isRecord(value.payloadLayout)) &&
	(value.includeLocationPopulationSummary === undefined ||
		typeof value.includeLocationPopulationSummary === "boolean");

const hasValidId = (value: unknown): value is Record<string, unknown> =>
	isRecord(value) &&
	typeof value.id === "number" &&
	Number.isSafeInteger(value.id) &&
	value.id >= 0;

const isCancelRequest = (value: unknown): value is CancelReq =>
	hasValidId(value) && value.type === "cancel";

const isWorkerRequest = (value: unknown): value is Req => {
	if (
		!hasValidId(value)
	)
		return false;
	return (
		value.type === undefined &&
		typeof value.url === "string" &&
		(value.filter === undefined || isDatasetLocationFilter(value.filter)) &&
		(value.chunkUrls === undefined ||
			(Array.isArray(value.chunkUrls) &&
				value.chunkUrls.every((url) => typeof url === "string")))
	);
};

const isAbortError = (error: unknown) =>
	error instanceof DOMException && error.name === "AbortError";

self.addEventListener("message", async (e: MessageEvent<unknown>) => {
	if (isCancelRequest(e.data)) {
		controllers.get(e.data.id)?.abort();
		return;
	}
	if (!isWorkerRequest(e.data)) return;
	const { id, url, filter, chunkUrls } = e.data;
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
							filter?.payloadLayout,
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
