/// <reference lib="webworker" />
import {
	readSpreadsheet,
	writeSpreadsheet,
	type SpreadsheetFormat,
	type Workbook,
} from "./index";

/** What the page asks the worker to do. */
export type WorkerRequest =
	| {
			id: number;
			op: "read";
			bytes: Uint8Array;
			format: SpreadsheetFormat;
			maxRows: number;
	  }
	| {
			id: number;
			op: "write";
			format: SpreadsheetFormat;
			sheetName: string;
			headers: string[];
			rows: string[][];
	  };

export type WorkerResponse =
	| { id: number; ok: true; workbook?: Workbook; bytes?: Uint8Array }
	| { id: number; ok: false; message: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;
	try {
		if (request.op === "read") {
			const workbook = readSpreadsheet(
				request.bytes,
				request.format,
				request.maxRows,
			);
			self.postMessage({ id: request.id, ok: true, workbook });
		} else {
			const bytes = writeSpreadsheet(
				request.format,
				request.sheetName,
				request.headers,
				request.rows,
			);
			self.postMessage({ id: request.id, ok: true, bytes }, [
				bytes.buffer,
			]);
		}
	} catch (error) {
		self.postMessage({
			id: request.id,
			ok: false,
			message: (error as Error).message,
		});
	}
};
