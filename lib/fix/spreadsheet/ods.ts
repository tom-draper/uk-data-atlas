import { strToU8, zipSync } from "fflate";
import {
	isoSerial,
	numberText,
	plainNumber,
	trimRow,
	trimRows,
	xmlAttribute,
	xmlText,
	type Sheet,
	type Workbook,
} from "./cells";
import { parseXml } from "./xml";
import { readParts } from "./zip";

/** A run of blank rows or columns is kept this long at most. */
const MAX_REPEAT = 1000;

const duration = (value: string) => {
	const match =
		/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(
			value,
		);
	if (!match) return value;
	const hours = Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(hours)}:${pad(Number(match[3] ?? 0))}:${pad(Math.round(Number(match[4] ?? 0)))}`;
};

function readTables(xml: string, maxRows: number): Sheet[] {
	const sheets: Sheet[] = [];
	let sheet: Sheet | null = null;
	let tableDepth = 0;
	let row: string[] = [];
	let rowRepeat = 1;
	let cell: {
		attributes: Record<string, string>;
		paragraphs: string[];
	} | null = null;
	let paragraph = -1;
	let annotation = 0;
	let columnRepeat = 1;

	const cellValue = () => {
		if (!cell) return "";
		const { attributes } = cell;
		switch (attributes["office:value-type"]) {
			case "float":
			case "percentage":
			case "currency":
				return attributes["office:value"] !== undefined
					? numberText(attributes["office:value"])
					: cell.paragraphs.join("\n");
			case "date":
				return (attributes["office:date-value"] ?? "").replace(
					/T00:00:00(?:\.0+)?$/,
					"",
				);
			case "time":
				return duration(attributes["office:time-value"] ?? "");
			case "boolean":
				return attributes["office:boolean-value"] === "true"
					? "TRUE"
					: "FALSE";
			default:
				return (
					attributes["office:string-value"] ??
					cell.paragraphs.join("\n")
				);
		}
	};

	parseXml(xml, {
		open(name, attributes) {
			if (name === "table:table") {
				// A table nested in a cell is not a sheet of its own.
				if (tableDepth++ === 0) {
					sheet = {
						name:
							attributes["table:name"] ??
							`Sheet ${sheets.length + 1}`,
						rows: [],
						extraRows: 0,
						hidden: false,
					};
					sheets.push(sheet);
				}
			} else if (tableDepth !== 1 || !sheet) {
				// Inside a nested table.
			} else if (name === "table:table-row") {
				row = [];
				rowRepeat = Number(
					attributes["table:number-rows-repeated"] ?? 1,
				);
			} else if (
				name === "table:table-cell" ||
				name === "table:covered-table-cell"
			) {
				cell = { attributes, paragraphs: [] };
				paragraph = -1;
				columnRepeat = Number(
					attributes["table:number-columns-repeated"] ?? 1,
				);
			} else if (!cell) {
				// Only a cell's own text is read.
			} else if (name === "office:annotation") annotation++;
			else if (annotation === 0) {
				if (name === "text:p") cell.paragraphs[++paragraph] = "";
				else if (paragraph >= 0 && name === "text:s")
					cell.paragraphs[paragraph] += " ".repeat(
						Number(attributes["text:c"] ?? 1),
					);
				else if (paragraph >= 0 && name === "text:tab")
					cell.paragraphs[paragraph] += "\t";
				else if (paragraph >= 0 && name === "text:line-break")
					cell.paragraphs[paragraph] += "\n";
			}
		},
		close(name) {
			if (name === "table:table") {
				tableDepth--;
				return;
			}
			if (tableDepth !== 1 || !sheet) return;
			if (name === "office:annotation") annotation--;
			else if (
				name === "table:table-cell" ||
				name === "table:covered-table-cell"
			) {
				const value = cellValue();
				// A blank run only pads a row; a value repeats where it is.
				const count = Math.min(
					columnRepeat,
					value === "" ? MAX_REPEAT : 16_384,
				);
				for (let i = 0; i < count; i++) row.push(value);
				cell = null;
			} else if (name === "table:table-row") {
				const trimmed = trimRow(row);
				const blank = trimmed.length === 0;
				const count = Math.min(rowRepeat, blank ? MAX_REPEAT : 100_000);
				for (let i = 0; i < count; i++) {
					if (sheet.rows.length < maxRows) sheet.rows.push(trimmed);
					else if (!blank) sheet.extraRows++;
				}
			}
		},
		text(text) {
			if (cell && annotation === 0 && paragraph >= 0)
				cell.paragraphs[paragraph] += text;
		},
	});
	for (const each of sheets) each.rows = trimRows(each.rows);
	return sheets;
}

/** Reads every sheet of an .ods file, each cell as the text a person would copy. */
export function readOds(bytes: Uint8Array, maxRows: number): Workbook {
	const parts = readParts(bytes, (name) => name === "content.xml");
	const content = parts.get("content.xml");
	if (!content) throw new Error("That file isn't a readable .ods workbook.");
	const sheets = readTables(content, maxRows);
	if (sheets.length === 0) throw new Error("That workbook has no sheets.");
	return { format: "ods", sheets };
}

const NS = [
	'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
	'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
	'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
	'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
	'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
	'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"',
].join(" ");

/** Text as paragraphs, keeping runs of spaces, tabs and blank lines. */
function paragraphs(value: string): string {
	return value
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => {
			const text = xmlText(line)
				.replace(/\t/g, "<text:tab/>")
				.replace(/ +/g, (spaces, offset: number) =>
					offset === 0
						? `<text:s text:c="${spaces.length}"/>`
						: spaces.length === 1
							? " "
							: ` <text:s text:c="${spaces.length - 1}"/>`,
				);
			return `<text:p>${text}</text:p>`;
		})
		.join("");
}

function cellXml(value: string, header: boolean): string {
	if (value === "") return "<table:table-cell/>";
	if (!header) {
		const number = plainNumber(value);
		if (number !== null)
			return `<table:table-cell office:value-type="float" office:value="${value}"><text:p>${value}</text:p></table:table-cell>`;
		const date = isoSerial(value);
		if (date)
			return `<table:table-cell table:style-name="${date.time ? "dt" : "d"}" office:value-type="date" office:date-value="${xmlAttribute(value.replace(" ", "T"))}"><text:p>${xmlText(value)}</text:p></table:table-cell>`;
	}
	return `<table:table-cell${header ? ' table:style-name="h"' : ""} office:value-type="string">${paragraphs(value)}</table:table-cell>`;
}

/** Writes a table as a one-sheet .ods, typing cells as writeXlsx does. */
export function writeOds(
	name: string,
	headers: string[],
	rows: string[][],
): Uint8Array {
	const width = Math.max(headers.length, 1);
	const line = (cells: string[], header: boolean) =>
		`<table:table-row>${cells.map((cell) => cellXml(cell, header)).join("")}</table:table-row>`;
	const body = [line(headers, true), ...rows.map((row) => line(row, false))];
	const sheet =
		name
			.replace(/[\\/?*[\]:]/g, " ")
			.trim()
			.slice(0, 31) || "Sheet1";

	const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} office:version="1.2"><office:automatic-styles><style:style style:name="h" style:family="table-cell"><style:text-properties fo:font-weight="bold"/></style:style><number:date-style style:name="N1"><number:year number:style="long"/><number:text>-</number:text><number:month number:style="long"/><number:text>-</number:text><number:day number:style="long"/></number:date-style><number:date-style style:name="N2"><number:year number:style="long"/><number:text>-</number:text><number:month number:style="long"/><number:text>-</number:text><number:day number:style="long"/><number:text> </number:text><number:hours number:style="long"/><number:text>:</number:text><number:minutes number:style="long"/><number:text>:</number:text><number:seconds number:style="long"/></number:date-style><style:style style:name="d" style:family="table-cell" style:data-style-name="N1"/><style:style style:name="dt" style:family="table-cell" style:data-style-name="N2"/></office:automatic-styles><office:body><office:spreadsheet><table:table table:name="${xmlAttribute(sheet)}"><table:table-column table:number-columns-repeated="${width}"/>${body.join("")}</table:table></office:spreadsheet></office:body></office:document-content>`;

	return zipSync(
		{
			// The type must be the first entry, stored as it is.
			mimetype: [
				strToU8("application/vnd.oasis.opendocument.spreadsheet"),
				{ level: 0 },
			],
			"META-INF/manifest.xml": strToU8(
				`<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`,
			),
			"content.xml": strToU8(content),
		},
		{ level: 6 },
	);
}
