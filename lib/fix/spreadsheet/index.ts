import type { Sheet, Workbook } from "./cells";
import { readOds, writeOds } from "./ods";
import { readXlsx, writeXlsx } from "./xlsx";

export type { Sheet, Workbook } from "./cells";

export type SpreadsheetFormat = "xlsx" | "ods";
export type FileFormat = "csv" | SpreadsheetFormat;

/** The format a file name says, or null when we can't read it. */
export function formatOf(name: string): FileFormat | null {
	const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase();
	if (extension === "xlsx" || extension === "xlsm") return "xlsx";
	if (extension === "ods") return "ods";
	if (extension === "csv" || extension === "tsv" || extension === "txt")
		return "csv";
	return null;
}

/** Whether a name is a spreadsheet format we know we can't read. */
export const isUnreadableSpreadsheet = (name: string) =>
	/\.(xls|xlsb|numbers|fods)$/i.test(name);

export const MIME: Record<FileFormat, string> = {
	csv: "text/csv;charset=utf-8",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ods: "application/vnd.oasis.opendocument.spreadsheet",
};

/** Every sheet of a workbook, reading at most `maxRows` rows of each. */
export function readSpreadsheet(
	bytes: Uint8Array,
	format: SpreadsheetFormat,
	maxRows: number,
): Workbook {
	return format === "xlsx"
		? readXlsx(bytes, maxRows)
		: readOds(bytes, maxRows);
}

const isEmpty = (sheet: Sheet) =>
	sheet.rows.every((row) => row.every((cell) => cell.trim() === ""));

/** Whether a sheet has a few rows of at least two columns, as a table does. */
function looksLikeTable(sheet: Sheet): boolean {
	let rows = 0;
	for (const row of sheet.rows) {
		let filled = 0;
		for (const cell of row) if (cell.trim() !== "") filled++;
		if (filled >= 2 && ++rows >= 2) return true;
	}
	return false;
}

/**
 * The sheet to open first: the first visible one that looks like a table, so
 * a cover or notes sheet is passed over, else the first visible one with
 * anything in it, else the first that has anything.
 */
export function defaultSheet(workbook: Workbook): number {
	const { sheets } = workbook;
	const table = sheets.findIndex(
		(sheet) => !sheet.hidden && looksLikeTable(sheet),
	);
	if (table !== -1) return table;
	const visible = sheets.findIndex(
		(sheet) => !sheet.hidden && !isEmpty(sheet),
	);
	if (visible !== -1) return visible;
	const any = sheets.findIndex((sheet) => !isEmpty(sheet));
	return any === -1 ? 0 : any;
}

/** Whether a sheet has any cell to read. */
export const hasCells = (sheet: Sheet) => !isEmpty(sheet);

/** A table written as a one-sheet spreadsheet. */
export function writeSpreadsheet(
	format: SpreadsheetFormat,
	sheetName: string,
	headers: string[],
	rows: string[][],
): Uint8Array {
	return format === "xlsx"
		? writeXlsx(sheetName, headers, rows)
		: writeOds(sheetName, headers, rows);
}
