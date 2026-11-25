import Papa from "papaparse";
import { detectHeaderRow } from "@/lib/data/custom/csv";

/**
 * Rows read from one file. Larger files are cut here and told so. It is
 * more than twice Great Britain's LSOAs and data zones (about 42,000), and
 * a check of that many still fits the API's 8 MB request limit.
 */
export const ROW_LIMIT = 100_000;

export interface Table {
	headers: string[];
	rows: string[][];
	/** Data rows beyond the limit that were left out. */
	droppedRows: number;
	/** Lines above the header, such as a title or notes, that were skipped. */
	skippedLines: number;
}

export interface ParsedTable extends Table {
	/** Index among non-empty rows, or null when the first row is data. */
	headerRow: number | null;
	headerOptions: string[][];
}

const looksLikeCode = (value: string) => /^[A-Za-z]\d{4,}$/.test(value.trim());

/**
 * Reads CSV, or tab-separated text pasted from a spreadsheet, keeping every
 * cell exactly as written so a download gives the same values back.
 */
export function parseTableLines(text: string): string[][] {
	return Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
		skipEmptyLines: "greedy",
	}).data;
}

export function readTable(text: string): Table {
	return tableFromLines(parseTableLines(text));
}

/**
 * Finds the header in lines of cells, whether from a CSV or a sheet, and
 * squares the rows up beneath it. A pasted column with no header gets one,
 * so its first value is not lost. `extraRows` is rows already left out.
 */
export function tableFromLines(
	all: string[][],
	extraRows = 0,
	headerOverride?: number | null,
): ParsedTable {
	const lines = all.filter((row) => row.some((cell) => cell.trim()));
	if (lines.length === 0)
		return {
			headerRow: null,
			headerOptions: [],
			headers: [],
			rows: [],
			droppedRows: extraRows,
			skippedLines: 0,
		};

	let headerRow = headerOverride;
	if (headerRow === undefined) {
		headerRow = detectHeaderRow(lines);
		const header = lines[headerRow];
		if (header.length === 1 && looksLikeCode(header[0])) headerRow = null;
	}
	const headers = headerRow === null ? [] : lines[headerRow];
	const body = headerRow === null ? lines : lines.slice(headerRow + 1);

	// A loop, not Math.max(...), which fails on very long tables.
	let width = headers.length;
	for (const row of body) if (row.length > width) width = row.length;
	const named = Array.from(
		{ length: width },
		(_, index) =>
			headers[index]?.trim() ||
			(headerRow === null && width === 1
				? "area"
				: `column ${index + 1}`),
	);
	const kept = Math.min(body.length, ROW_LIMIT);
	const rows: string[][] = new Array(kept);
	for (let i = 0; i < kept; i++) {
		const row = body[i];
		rows[i] =
			row.length === width
				? row
				: Array.from({ length: width }, (_, index) => row[index] ?? "");
	}

	return {
		headerRow,
		headerOptions: lines.slice(0, 20),
		headers: named,
		rows,
		droppedRows: body.length - kept + extraRows,
		skippedLines: headerRow ?? 0,
	};
}

/** Writes a table back out as CSV. */
export function writeCsv(headers: string[], rows: string[][]): string {
	return `${Papa.unparse({ fields: headers, data: rows }, { newline: "\n" })}\n`;
}

/** A column header that does not clash with the ones already present. */
export function freeHeader(headers: string[], wanted: string): string {
	if (!headers.includes(wanted)) return wanted;
	let suffix = 2;
	while (headers.includes(`${wanted}_${suffix}`)) suffix++;
	return `${wanted}_${suffix}`;
}
