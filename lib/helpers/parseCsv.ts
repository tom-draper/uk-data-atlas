import Papa, { ParseConfig } from "papaparse";

export interface ParseCsvResult<T> {
	data: T[];
	fields: string[];
}

export interface ParseCsvConfig<T> extends Omit<
	ParseConfig<T>,
	"complete" | "error"
> {
	/**
	 * Number of leading lines to discard before parsing.
	 * Use `findHeaderLine` to compute this dynamically when the metadata
	 * length is not known ahead of time.
	 */
	skipLines?: number;
}

/**
 * Returns the index of the first line containing `marker` (case-insensitive).
 * Returns 0 if not found.
 */
export function findHeaderLine(text: string, marker: string): number {
	const lower = marker.toLowerCase();
	let start = 0;
	let line = 0;
	while (start <= text.length) {
		const end = text.indexOf("\n", start);
		const lineText = text.slice(start, end === -1 ? text.length : end);
		if (lineText.toLowerCase().includes(lower)) return line;
		if (end === -1) break;
		start = end + 1;
		line++;
	}
	return 0;
}

const afterLeadingLines = (text: string, lines: number) => {
	let start = 0;
	for (let line = 0; line < lines; line++) {
		const end = text.indexOf("\n", start);
		if (end === -1) return "";
		start = end + 1;
	}
	return text.slice(start);
};

/**
 * Promise-based PapaParse wrapper.
 * Defaults: `skipEmptyLines: true`, `dynamicTyping: false`.
 * Returns `{ data, fields }` where `fields` is the array of column header
 * names (`[]` when `header: false`).
 */
export async function parseCsv<T = Record<string, string>>(
	text: string,
	config: ParseCsvConfig<T> = {},
): Promise<ParseCsvResult<T>> {
	const { skipLines = 0, ...papaConfig } = config;

	const input = skipLines > 0 ? afterLeadingLines(text, skipLines) : text;

	return new Promise((resolve, reject) => {
		Papa.parse<T>(input, {
			skipEmptyLines: true,
			dynamicTyping: false,
			...papaConfig,
			complete(results) {
				resolve({
					data: results.data,
					fields: results.meta.fields ?? [],
				});
			},
			error(err: Error) {
				reject(new Error(`CSV parse error: ${err.message}`));
			},
		});
	});
}
