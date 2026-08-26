import { decodeBoundaryData } from "../data/boundaries/decode";

interface Request {
	id: number;
	url: string;
}

interface Response {
	id: number;
	data?: unknown;
	error?: string;
}

self.addEventListener("message", async (event: MessageEvent<Request>) => {
	const { id, url } = event.data;
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`${response.status} ${response.statusText}`);
		}
		const data = decodeBoundaryData(await response.json());
		(self as unknown as Worker).postMessage({
			id,
			data,
		} satisfies Response);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		(self as unknown as Worker).postMessage({
			id,
			error: message,
		} satisfies Response);
	}
});
