import Papa from "papaparse";

/** Parse uploaded CSV into trimmed rows while preserving column positions. */
export function parseCustomCsv(text: string): string[][] {
	const result = Papa.parse<string[]>(text, {
		skipEmptyLines: true,
		transform: (value) => value.trim(),
	});
	return result.data;
}

/**
 * Finds the first full-width, mostly textual row among the first 20 rows.
 * Uploaded public datasets frequently include notes before their header.
 */
export function detectHeaderRow(rows: string[][]): number {
	if (rows.length === 0) return 0;

	const isNumeric = (value: string) =>
		value.trim() !== "" && !Number.isNaN(Number(value.trim()));
	const maxColumns = Math.max(
		...rows
			.slice(0, 20)
			.map((row) => row.filter((cell) => cell.trim() !== "").length),
	);

	for (let index = 0; index < Math.min(rows.length, 20); index++) {
		const cells = rows[index].filter((cell) => cell.trim() !== "");
		if (cells.length < maxColumns) continue;
		const numericCount = cells.filter(isNumeric).length;
		if ((cells.length - numericCount) / cells.length >= 0.5) return index;
	}

	return 0;
}
