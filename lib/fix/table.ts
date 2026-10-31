import Papa from "papaparse";
import { detectHeaderRow } from "@/lib/data/custom/csv";

/** Rows read from one file. Larger files are cut here and told so. */
export const ROW_LIMIT = 10_000;

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
 * cell exactly as written so a download gives the same values back. A pasted
 * column with no header gets one, so its first value is not lost.
 */
export function readTable(text: string): Table {
	const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
		skipEmptyLines: "greedy",
	});
	const lines = parsed.data.filter((row) => row.some((cell) => cell.trim()));
	if (lines.length === 0)
		return { headers: [], rows: [], droppedRows: 0, skippedLines: 0 };

	let headerRow = detectHeaderRow(lines);
	let headers = lines[headerRow];
	let body = lines.slice(headerRow + 1);
	if (headers.length === 1 && looksLikeCode(headers[0])) {
		headerRow = 0;
		headers = ["area"];
		body = lines;
	}

	const width = Math.max(headers.length, ...body.map((row) => row.length));
	const named = Array.from(
		{ length: width },
		(_, index) => headers[index]?.trim() || `column ${index + 1}`,
	);
	const rows = body
		.slice(0, ROW_LIMIT)
		.map((row) =>
			Array.from({ length: width }, (_, index) => row[index] ?? ""),
		);

	return {
		headers: named,
		rows,
		droppedRows: Math.max(0, body.length - ROW_LIMIT),
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
