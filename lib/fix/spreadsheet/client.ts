import {
	readSpreadsheet,
	writeSpreadsheet,
	type SpreadsheetFormat,
	type Workbook,
} from "./index";
import type { WorkerRequest, WorkerResponse } from "./worker";

/**
 * Reading and writing a large workbook takes seconds of CPU, so it runs in a
 * worker and the page stays responsive. The parser is a separate chunk, loaded
 * only when a spreadsheet is dropped or downloaded; CSV never loads it. Where
 * workers aren't available the same code runs on the page.
 */

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
	number,
	{
		resolve: (response: Extract<WorkerResponse, { ok: true }>) => void;
		reject: (error: Error) => void;
	}
>();

function connect(): Worker | null {
	if (worker) return worker;
	if (typeof Worker === "undefined") return null;
	try {
		worker = new Worker(new URL("./worker.ts", import.meta.url), {
			type: "module",
		});
	} catch {
		return null;
	}
	worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
		const waiting = pending.get(event.data.id);
		if (!waiting) return;
		pending.delete(event.data.id);
		if (event.data.ok) waiting.resolve(event.data);
		else waiting.reject(new Error(event.data.message));
	};
	worker.onerror = () => {
		for (const waiting of pending.values())
			waiting.reject(
				new Error("The spreadsheet could not be processed."),
			);
		pending.clear();
		worker?.terminate();
		worker = null;
	};
	return worker;
}

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

function call(
	request: WithoutId<WorkerRequest>,
	transfer: Transferable[] = [],
) {
	const target = connect();
	if (!target) return null;
	const id = nextId++;
	return new Promise<Extract<WorkerResponse, { ok: true }>>(
		(resolve, reject) => {
			pending.set(id, { resolve, reject });
			target.postMessage({ ...request, id }, transfer);
		},
	);
}

export async function readWorkbook(
	bytes: Uint8Array,
	format: SpreadsheetFormat,
	maxRows: number,
): Promise<Workbook> {
	const response = call({ op: "read", bytes, format, maxRows }, [
		bytes.buffer,
	]);
	if (response) {
		const { workbook } = await response;
		if (workbook) return workbook;
	}
	return readSpreadsheet(bytes, format, maxRows);
}

export async function writeWorkbook(
	format: SpreadsheetFormat,
	sheetName: string,
	headers: string[],
	rows: string[][],
): Promise<Uint8Array> {
	const response = call({ op: "write", format, sheetName, headers, rows });
	if (response) {
		const { bytes } = await response;
		if (bytes) return bytes;
	}
	return writeSpreadsheet(format, sheetName, headers, rows);
}
