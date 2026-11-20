import {
	formatOf,
	hasCells,
	isUnreadableSpreadsheet,
	defaultSheet,
	type FileFormat,
	type Workbook,
} from "./spreadsheet";
import { readTable, ROW_LIMIT, tableFromLines, type Table } from "./table";

/** Largest file read, whatever its type. */
export const MAX_BYTES = 50 * 1024 * 1024;

/** A file the user added, as a table, and what is needed to give it back. */
export interface Upload {
	name: string;
	format: FileFormat;
	/** The sheets of a workbook, with the one the table was read from. */
	sheets: { name: string; hidden: boolean; empty: boolean }[];
	sheet: number;
	table: Table;
	/** The workbook, kept so another sheet can be chosen without reading again. */
	workbook?: Workbook;
}

export class UploadError extends Error {}

/** Reads a CSV, or pasted text, as an upload. */
export function csvUpload(text: string, name: string): Upload {
	return {
		name,
		format: "csv",
		sheets: [],
		sheet: 0,
		table: readTable(text),
	};
}

/** The same upload, read from another sheet of its workbook. */
export function withSheet(upload: Upload, sheet: number): Upload {
	const workbook = upload.workbook;
	if (!workbook || !workbook.sheets[sheet]) return upload;
	const chosen = workbook.sheets[sheet];
	return {
		...upload,
		sheet,
		table: tableFromLines(chosen.rows, chosen.extraRows),
	};
}

function workbookUpload(name: string, workbook: Workbook): Upload {
	const upload: Upload = {
		name,
		format: workbook.format,
		sheets: workbook.sheets.map((sheet) => ({
			name: sheet.name,
			hidden: sheet.hidden,
			empty: !hasCells(sheet),
		})),
		sheet: 0,
		table: { headers: [], rows: [], droppedRows: 0, skippedLines: 0 },
		workbook,
	};
	return withSheet(upload, defaultSheet(workbook));
}

/** Reads a dropped or chosen file. Spreadsheet code loads only when one is read. */
export async function readUpload(file: File): Promise<Upload> {
	if (file.size > MAX_BYTES)
		throw new UploadError(
			`${file.name} is larger than ${MAX_BYTES / 1024 / 1024} MB. Try a smaller file, or the first ${ROW_LIMIT.toLocaleString("en-GB")} rows.`,
		);
	const format = formatOf(file.name);
	if (isUnreadableSpreadsheet(file.name))
		throw new UploadError(
			"That spreadsheet format can't be read here. Save it as .xlsx, .ods or CSV and add it again.",
		);
	if (format === "xlsx" || format === "ods") {
		const { readWorkbook } = await import("./spreadsheet/client");
		try {
			// A little more than the limit, so the count left out is right.
			const workbook = await readWorkbook(
				new Uint8Array(await file.arrayBuffer()),
				format,
				ROW_LIMIT + 1000,
			);
			return workbookUpload(file.name, workbook);
		} catch (error) {
			throw new UploadError((error as Error).message);
		}
	}
	return csvUpload(await file.text(), file.name);
}
