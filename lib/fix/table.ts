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

const looksLikeCode = (value: string) => /^[A-Za-z]\d{4,}$/.test(value.trim());

/**
 * Reads CSV, or tab-separated text pasted from a spreadsheet, keeping every
 * cell exactly as written so a download gives the same values back.
 */
export function readTable(text: string): Table {
	const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
		skipEmptyLines: "greedy",
	});
	return tableFromLines(parsed.data);
}

/**
 * Finds the header in lines of cells, whether from a CSV or a sheet, and
 * squares the rows up beneath it. A pasted column with no header gets one,
 * so its first value is not lost. `extraRows` is rows already left out.
 */
export function tableFromLines(all: string[][], extraRows = 0): Table {
	const lines = all.filter((row) => row.some((cell) => cell.trim()));
	if (lines.length === 0)
		return {
			headers: [],
			rows: [],
			droppedRows: extraRows,
			skippedLines: 0,
		};

	let headerRow = detectHeaderRow(lines);
	let headers = lines[headerRow];
	let body = lines.slice(headerRow + 1);
	if (headers.length === 1 && looksLikeCode(headers[0])) {
		headerRow = 0;
		headers = ["area"];
		body = lines;
	}

	// A loop, not Math.max(...), which fails on very long tables.
	let width = headers.length;
	for (const row of body) if (row.length > width) width = row.length;
	const named = Array.from(
		{ length: width },
		(_, index) => headers[index]?.trim() || `column ${index + 1}`,
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
		headers: named,
		rows,
		droppedRows: body.length - kept + extraRows,
		skippedLines: headerRow,
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
