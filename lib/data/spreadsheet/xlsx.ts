/**
 * Reads a worksheet out of an .xlsx workbook.
 *
 * An .xlsx is a zip of XML parts: the workbook names its sheets, a rels file
 * maps those names to sheet files, and most text lives once in a shared string
 * table that cells reference by index. These functions take the already
 * unzipped parts, so they stay pure and testable; the unzipping lives with the
 * precompiler.
 */

const decodeXml = (value: string) =>
	value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&amp;/g, "&");

/** Spreadsheet column letters to a zero-based index: A→0, Z→25, AA→26. */
export function columnIndex(reference: string): number {
	const letters = /^[A-Z]+/.exec(reference)?.[0] ?? "";
	let index = 0;
	for (const letter of letters) {
		index = index * 26 + (letter.charCodeAt(0) - 64);
	}
	return index - 1;
}

/**
 * The workbook's shared strings, in index order. A single entry can be split
 * into several runs when parts of it are styled differently, so every `<t>`
 * inside one `<si>` is joined back together.
 */
export function parseSharedStrings(xml: string): string[] {
	const strings: string[] = [];
	for (const entry of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
		let text = "";
		for (const run of entry[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
			text += run[1];
		}
		strings.push(decodeXml(text));
	}
	return strings;
}

/**
 * The path of a named sheet within the archive, e.g. "xl/worksheets/sheet4.xml".
 * The workbook gives each sheet a relationship id; the rels file says which
 * file that id points at.
 */
export function findSheetPath(
	workbookXml: string,
	relsXml: string,
	sheetName: string,
): string {
	const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)].map(
		(match) => match[1],
	);
	const wanted = sheets.find(
		(attrs) =>
			decodeXml(/name="([^"]*)"/.exec(attrs)?.[1] ?? "") === sheetName,
	);
	if (!wanted) {
		const names = sheets
			.map((attrs) => decodeXml(/name="([^"]*)"/.exec(attrs)?.[1] ?? ""))
			.join(", ");
		throw new Error(
			`Worksheet "${sheetName}" not found. The workbook has: ${names}`,
		);
	}

	const relationshipId = /r:id="([^"]*)"/.exec(wanted)?.[1];
	if (!relationshipId) {
		throw new Error(`Worksheet "${sheetName}" has no relationship id`);
	}

	const target = [...relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)]
		.map((match) => match[1])
		.find((attrs) => /Id="([^"]*)"/.exec(attrs)?.[1] === relationshipId);
	const path = target && /Target="([^"]*)"/.exec(target)?.[1];
	if (!path) {
		throw new Error(
			`Worksheet "${sheetName}" points at ${relationshipId}, which the workbook does not define`,
		);
	}

	return path.startsWith("/") ? path.slice(1) : `xl/${path}`;
}

// Built-in formats that mean "percentage"; the rest are declared per workbook.
const BUILT_IN_PERCENT_FORMATS = new Set([9, 10]);

/**
 * Which cell styles render as a percentage. Excel stores 25.6% as 0.256 and
 * scales it for display, so a reader that ignores formats reports every
 * percentage a hundred times too small.
 */
export function percentageStyles(stylesXml: string): Set<number> {
	const percentFormatIds = new Set(BUILT_IN_PERCENT_FORMATS);
	for (const format of stylesXml.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
		// Format codes arrive XML-escaped, and a quoted %"" is a literal.
		const code = decodeXml(
			/formatCode="([^"]*)"/.exec(format[1])?.[1] ?? "",
		);
		const id = Number(/numFmtId="(\d+)"/.exec(format[1])?.[1] ?? "-1");
		if (id >= 0 && code.replace(/"[^"]*"|\\./g, "").includes("%")) {
			percentFormatIds.add(id);
		}
	}

	const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(
		stylesXml,
	)?.[1];
	const styles = new Set<number>();
	if (!cellXfs) return styles;

	let index = 0;
	for (const xf of cellXfs.matchAll(/<xf\b([^>]*?)(?:\/>|>)/g)) {
		const id = Number(/numFmtId="(\d+)"/.exec(xf[1])?.[1] ?? "-1");
		if (percentFormatIds.has(id)) styles.add(index);
		index++;
	}
	return styles;
}

// Excel writes a number's shortest round-trip form; JSON parsing of the raw
// value can surface float noise like 39.200000000000003.
const tidyNumber = (raw: string): string => {
	const value = Number(raw);
	if (!Number.isFinite(value) || raw.trim() === "") return raw;
	return String(Number(value.toPrecision(15)));
};

/**
 * The sheet as rows of cell text. Cells are placed by their own reference, so
 * skipped columns become empty strings rather than shifting a row left.
 */
export function sheetRows(
	sheetXml: string,
	sharedStrings: string[],
	percentageStyleIds: ReadonlySet<number> = new Set(),
): string[][] {
	const rows: string[][] = [];

	for (const rowMatch of sheetXml.matchAll(
		/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g,
	)) {
		const row: string[] = [];
		for (const cellMatch of (rowMatch[1] ?? "").matchAll(
			// Self-closing form must be tried first: its attrs can end in "/",
			// which the open/close alternative's [^>]* also matches, causing it
			// to swallow the next cell's content up to that cell's </c>.
			/<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g,
		)) {
			const attrs = cellMatch[1] ?? cellMatch[2] ?? "";
			const body = cellMatch[3] ?? "";
			const type = /\bt="([^"]*)"/.exec(attrs)?.[1];

			let value = "";
			if (type === "s") {
				const index = Number(
					/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "-1",
				);
				value = sharedStrings[index] ?? "";
			} else if (type === "inlineStr") {
				for (const run of body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
					value += run[1];
				}
				value = decodeXml(value);
			} else {
				const raw = decodeXml(
					/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "",
				);
				const style = Number(/\bs="(\d+)"/.exec(attrs)?.[1] ?? "-1");
				value = percentageStyleIds.has(style)
					? tidyNumber(String(Number(raw) * 100))
					: tidyNumber(raw);
			}

			const reference = /\br="([^"]*)"/.exec(attrs)?.[1];
			const column = reference ? columnIndex(reference) : row.length;
			while (row.length < column) row.push("");
			row[column] = value;
		}
		rows.push(row);
	}

	return rows;
}

/** Renders rows as CSV, so existing text-based loaders need no changes. */
export function rowsToCsv(rows: string[][]): string {
	return rows
		.map((row) =>
			row
				.map((cell) =>
					/[",\n\r]/.test(cell)
						? `"${cell.replace(/"/g, '""')}"`
						: cell,
				)
				.join(","),
		)
		.join("\n");
}
