import {
	filterDatasetPayloadForLocation,
	type DatasetLocationFilter,
} from "../data/datasetLocationFilter";

interface Req {
	id: number;
	url: string;
	filter?: DatasetLocationFilter;
}
interface Res {
	id: number;
	data?: unknown;
	error?: string;
}

self.addEventListener("message", async (e: MessageEvent<Req>) => {
	const { id, url, filter } = e.data;
	try {
		const response = await fetch(url);
		if (!response.ok)
			throw new Error(`${response.status} ${response.statusText}`);
		const data = await filterDatasetPayloadForLocation(
			await response.json(),
			filter,
		);
		(self as unknown as Worker).postMessage({ id, data } satisfies Res);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		(self as unknown as Worker).postMessage({
			id,
			error: msg,
		} satisfies Res);
	}
});
