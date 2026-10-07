/** A worker's reply to one request: its data, or why it has none. */
export interface WorkerResponse {
	id: number;
	data?: unknown;
	error?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const isWorkerResponse = (value: unknown): value is WorkerResponse =>
	isRecord(value) &&
	typeof value.id === "number" &&
	Number.isSafeInteger(value.id) &&
	value.id >= 0 &&
	(value.error === undefined
		? "data" in value
		: typeof value.error === "string" && !("data" in value));
