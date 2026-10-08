import { spawn } from "child_process";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import {
	forEachXlsSheetRow,
	readWorkbookStream,
	xlsSheetRows,
} from "../../../lib/data/spreadsheet/xls";
import { rowsToCsv } from "../../../lib/data/spreadsheet/xlsx";
import { SOURCE_DATA } from "../paths.mts";

/**
 * Reads a legacy .xls workbook. Some publishers ship the workbook inside a
 * zip — HPSSA is 128 MB uncompressed against 36 MB zipped — so a zip holding a
 * single .xls is unwrapped first.
 */
const readXlsWorkbook = async (path: string): Promise<Uint8Array> => {
	const fullPath = join(SOURCE_DATA, path);
	await stat(fullPath);
	if (!path.endsWith(".zip")) return readFile(fullPath);
	return new Promise<Uint8Array>((resolve, reject) => {
		const unzip = spawn("unzip", ["-p", fullPath, "*.xls"]);
		if (!unzip.stdout) {
			reject(new Error(`Could not extract ${path}.`));
			return;
		}
		const chunks: Buffer[] = [];
		let stderr = "";
		unzip.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
		unzip.stderr?.setEncoding("utf8");
		unzip.stderr?.on("data", (chunk: string) => {
			stderr += chunk;
		});
		unzip.on("error", reject);
		unzip.on("close", (code) => {
			if (code !== 0) {
				reject(
					new Error(`Could not extract ${path}: ${stderr.trim()}`),
				);
				return;
			}
			resolve(Buffer.concat(chunks));
		});
	});
};

/** Pulls one named worksheet out of a legacy .xls and renders it as CSV. */
export const readXlsSheet = async (
	path: string,
	sheetName: string,
): Promise<string> => {
	const bytes = await readXlsWorkbook(path);
	const stream = readWorkbookStream(new Uint8Array(bytes));
	return rowsToCsv(xlsSheetRows(stream, sheetName));
};

/** Visits a worksheet's rows, and returns the workbook bytes for hashing. */
export const visitXlsSheetRows = async (
	path: string,
	sheetName: string,
	visit: (row: ReadonlyMap<number, string>) => void,
) => {
	const bytes = await readXlsWorkbook(path);
	forEachXlsSheetRow(readWorkbookStream(bytes), sheetName, visit);
	return bytes;
};
