/**
 * Minimal reader for the ODF spreadsheets (`content.xml` out of an .ods)
 * published by DWP and MHCLG. Sits alongside xlsx.ts, which does the same job
 * for the Office Open XML workbooks.
 */

/** ODF stores cell text as escaped XML with inline styling spans. */
export const decodeXml = (value: string) =>
	value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();

const ROW = /<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/g;
const CELL =
	/<table:table-cell\b([^>]*)>([\s\S]*?)<\/table:table-cell>|<table:table-cell\b([^>]*)\/>/g;

/**
 * The cells of one named sheet, row by row.
 *
 * `maxColumns` is not a convenience: these workbooks pad every row out to the
 * full 16,384 spreadsheet columns with a single repeated empty cell, so
 * expanding `table:number-columns-repeated` unbounded would allocate that
 * padding for every row. Pass the number of columns the table actually uses.
 *
 * `label` only names the source in the error thrown when the sheet is absent,
 * which is the difference between a build failure that identifies the dataset
 * and one that does not.
 */
export function odsTableRows(
	contentXml: string,
	{
		table,
		label,
		maxColumns,
	}: { table: string; label: string; maxColumns: number },
): string[][] {
	const start = contentXml.indexOf(`<table:table table:name="${table}"`);
	if (start === -1)
		throw new Error(`Could not find ${table} in ${label} source`);
	const end = contentXml.indexOf("</table:table>", start);
	if (end === -1)
		throw new Error(`Could not read ${table} in ${label} source`);

	const rows: string[][] = [];
	for (const rowMatch of contentXml.slice(start, end).matchAll(ROW)) {
		const cells: string[] = [];
		for (const cellMatch of rowMatch[1].matchAll(CELL)) {
			const attrs = cellMatch[1] ?? cellMatch[3] ?? "";
			const value =
				/office:value="([^"]*)"/.exec(attrs)?.[1] ??
				decodeXml(cellMatch[2] ?? "");
			const repeats = Number(
				/table:number-columns-repeated="(\d+)"/.exec(attrs)?.[1] ?? 1,
			);
			for (let i = 0; i < repeats && cells.length < maxColumns; i++)
				cells.push(value);
		}
		rows.push(cells);
	}
	return rows;
}
