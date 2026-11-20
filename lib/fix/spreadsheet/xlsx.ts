import { strToU8, zipSync } from "fflate";
import {
	columnIndex,
	columnLetters,
	isoSerial,
	numberText,
	plainNumber,
	serialText,
	trimRow,
	trimRows,
	xmlAttribute,
	xmlText,
	type Sheet,
	type Workbook,
} from "./cells";
import { parseXml, type Attributes } from "./xml";
import { readParts, resolvePart } from "./zip";

/** Excel's built-in number formats that show a date or a time. */
const BUILT_IN_DATES = new Set([
	14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
	45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58,
]);

/** Whether a custom number format code shows a date or a time. */
export function isDateFormat(code: string): boolean {
	const bare = code
		.replace(/"[^"]*"/g, "")
		.replace(/\\./g, "")
		.replace(/_.|\*./g, "")
		.replace(/\[(?![hms])[^\]]*\]/gi, "");
	return /[dmyhs]/i.test(bare);
}

/** `_x000D_` style escapes Excel uses for characters XML cannot hold. */
const unescapeText = (text: string) =>
	text.includes("_x")
		? text.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) =>
				String.fromCharCode(Number.parseInt(hex, 16)),
			)
		: text;

function readSharedStrings(xml: string): string[] {
	const strings: string[] = [];
	let current = "";
	let inText = false;
	let skip = 0;
	parseXml(
		xml,
		{
			open(name) {
				if (name === "si") current = "";
				else if (name === "rPh" || name === "phoneticPr") skip++;
				else if (name === "t" && skip === 0) inText = true;
			},
			close(name) {
				if (name === "si") strings.push(unescapeText(current));
				else if (name === "rPh" || name === "phoneticPr") skip--;
				else if (name === "t") inText = false;
			},
			text(text) {
				if (inText) current += text;
			},
		},
		{ localNames: true },
	);
	return strings;
}

/** Which cell formats (by index into cellXfs) show dates. */
function readDateStyles(xml: string): Set<number> {
	const custom = new Map<number, string>();
	const xfs: number[] = [];
	let inCellXfs = false;
	parseXml(
		xml,
		{
			open(name, attributes) {
				if (name === "numFmt")
					custom.set(
						Number(attributes.numFmtId),
						attributes.formatCode ?? "",
					);
				else if (name === "cellXfs") inCellXfs = true;
				else if (name === "xf" && inCellXfs)
					xfs.push(Number(attributes.numFmtId ?? 0));
			},
			close(name) {
				if (name === "cellXfs") inCellXfs = false;
			},
			text() {},
		},
		{ localNames: true },
	);
	const dates = new Set<number>();
	xfs.forEach((id, index) => {
		const code = custom.get(id);
		if (code !== undefined ? isDateFormat(code) : BUILT_IN_DATES.has(id))
			dates.add(index);
	});
	return dates;
}

interface SheetRef {
	name: string;
	path: string;
	hidden: boolean;
}

function readWorkbookParts(parts: Map<string, string>): {
	sheets: SheetRef[];
	date1904: boolean;
} {
	let workbookPath = "xl/workbook.xml";
	const root = parts.get("_rels/.rels");
	if (root)
		parseXml(
			root,
			{
				open(name, attributes) {
					if (
						name === "Relationship" &&
						/officeDocument$/.test(attributes.Type ?? "")
					)
						workbookPath = resolvePart(
							"_rels/.rels",
							attributes.Target ?? "",
						).replace(/^_rels\//, "");
				},
				close() {},
				text() {},
			},
			{ localNames: true },
		);
	const workbook = parts.get(workbookPath);
	if (!workbook)
		throw new Error("That file isn't a readable .xlsx workbook.");

	const targets = new Map<string, string>();
	const relsPath = workbookPath.replace(/([^/]+)$/, "_rels/$1.rels");
	parseXml(
		parts.get(relsPath) ?? "",
		{
			open(name, attributes) {
				if (name === "Relationship" && attributes.Id)
					targets.set(
						attributes.Id,
						resolvePart(workbookPath, attributes.Target ?? ""),
					);
			},
			close() {},
			text() {},
		},
		{ localNames: true },
	);

	const sheets: SheetRef[] = [];
	let date1904 = false;
	parseXml(
		workbook,
		{
			open(name, attributes: Attributes) {
				if (name === "workbookPr")
					date1904 =
						attributes.date1904 === "1" ||
						attributes.date1904 === "true";
				if (name !== "sheet") return;
				const id =
					attributes["r:id"] ??
					Object.entries(attributes).find(([key]) =>
						key.endsWith(":id"),
					)?.[1];
				const path = id ? targets.get(id) : undefined;
				// A chart sheet or an unreadable reference has no cells.
				if (path && /worksheets?\//i.test(path))
					sheets.push({
						name: attributes.name ?? `Sheet ${sheets.length + 1}`,
						path,
						hidden:
							!!attributes.state &&
							attributes.state !== "visible",
					});
			},
			close() {},
			text() {},
		},
		{ localNames: true },
	);
	return { sheets, date1904 };
}

function readSheet(
	xml: string,
	strings: string[],
	dateStyles: Set<number>,
	date1904: boolean,
	maxRows: number,
): { rows: string[][]; extraRows: number } {
	const rows: string[][] = [];
	let extraRows = 0;
	let row: string[] = [];
	let rowIndex = -1;
	let nextColumn = 0;
	let column = 0;
	let type = "n";
	let style = -1;
	let value = "";
	let inline = "";
	let inValue = false;
	let inText = false;
	let inInline = false;
	let skip = 0;

	const finishCell = () => {
		let text = "";
		if (inline !== "" || type === "inlineStr") text = unescapeText(inline);
		else if (value !== "") {
			switch (type) {
				case "s":
					text = strings[Number(value)] ?? "";
					break;
				case "b":
					text = value === "1" ? "TRUE" : "FALSE";
					break;
				case "str":
				case "e":
					text = unescapeText(value);
					break;
				case "d":
					text = value.replace(/T00:00:00(?:\.0+)?Z?$/, "");
					break;
				default:
					text = dateStyles.has(style)
						? serialText(Number(value), date1904)
						: numberText(value);
			}
		}
		if (text !== "") row[column] = text;
	};

	parseXml(
		xml,
		{
			open(name, attributes) {
				switch (name) {
					case "row": {
						const given = Number(attributes.r) - 1;
						rowIndex =
							Number.isInteger(given) && given >= 0
								? given
								: rowIndex + 1;
						row = [];
						nextColumn = 0;
						break;
					}
					case "c": {
						column = attributes.r
							? columnIndex(attributes.r)
							: nextColumn;
						if (column < 0) column = nextColumn;
						nextColumn = column + 1;
						type = attributes.t ?? "n";
						style = Number(attributes.s ?? -1);
						value = "";
						inline = "";
						break;
					}
					case "v":
						inValue = true;
						break;
					case "is":
						inInline = true;
						break;
					case "rPh":
						skip++;
						break;
					case "t":
						if (inInline && skip === 0) inText = true;
						break;
				}
			},
			close(name) {
				switch (name) {
					case "v":
						inValue = false;
						break;
					case "is":
						inInline = false;
						break;
					case "rPh":
						skip--;
						break;
					case "t":
						inText = false;
						break;
					case "c":
						finishCell();
						break;
					case "row": {
						if (rows.length >= maxRows) {
							// Count only rows that hold something.
							if (row.some((cell) => cell !== undefined))
								extraRows++;
							break;
						}
						// Rows a sheet skips are blank rows in the table.
						while (rows.length < rowIndex && rows.length < maxRows)
							rows.push([]);
						rows.push(
							trimRow(Array.from(row, (cell) => cell ?? "")),
						);
						break;
					}
				}
			},
			text(text) {
				if (inValue) value += text;
				else if (inText) inline += text;
			},
		},
		{ localNames: true },
	);
	return { rows: trimRows(rows), extraRows };
}

/** Reads every sheet of an .xlsx file, each cell as the text a person would copy. */
export function readXlsx(bytes: Uint8Array, maxRows: number): Workbook {
	const parts = readParts(
		bytes,
		(name) =>
			name === "_rels/.rels" ||
			(name.startsWith("xl/") && /\.(xml|rels)$/.test(name)),
	);
	const { sheets: refs, date1904 } = readWorkbookParts(parts);
	if (refs.length === 0) throw new Error("That workbook has no sheets.");

	const strings = readSharedStrings(
		parts.get("xl/sharedStrings.xml") ??
			[...parts].find(([name]) =>
				/sharedStrings\.xml$/.test(name),
			)?.[1] ??
			"",
	);
	const dateStyles = readDateStyles(parts.get("xl/styles.xml") ?? "");

	const sheets: Sheet[] = refs.map((ref) => {
		const { rows, extraRows } = readSheet(
			parts.get(ref.path) ?? "",
			strings,
			dateStyles,
			date1904,
			maxRows,
		);
		return { name: ref.name, rows, extraRows, hidden: ref.hidden };
	});
	return { format: "xlsx", sheets };
}

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL =
	"http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Excel's rules for a sheet name. */
export function sheetName(name: string): string {
	return (
		name
			.replace(/[\\/?*[\]:]/g, " ")
			.trim()
			.slice(0, 31) || "Sheet1"
	);
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${MAIN}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd\\ hh:mm:ss"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const escapeControl = (text: string) =>
	text.replace(
		/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
		(char) =>
			`_x${char.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()}_`,
	);

function cellXml(reference: string, value: string, header: boolean): string {
	if (value === "") return header ? `<c r="${reference}" s="1"/>` : "";
	const style = header ? ' s="1"' : "";
	if (!header) {
		const number = plainNumber(value);
		if (number !== null) return `<c r="${reference}"><v>${value}</v></c>`;
		const date = isoSerial(value);
		if (date)
			return `<c r="${reference}" s="${date.time ? 3 : 2}"><v>${Number(date.serial.toFixed(9))}</v></c>`;
	}
	const space = /^\s|\s$|\n/.test(value) ? ' xml:space="preserve"' : "";
	return `<c r="${reference}" t="inlineStr"${style}><is><t${space}>${xmlText(escapeControl(value))}</t></is></c>`;
}

/**
 * Writes a table as a one-sheet .xlsx. Plain numbers and ISO dates become
 * number and date cells, so a column of counts still sums; everything else is
 * text, so a code such as "00123" keeps its zeros.
 */
export function writeXlsx(
	name: string,
	headers: string[],
	rows: string[][],
): Uint8Array {
	const lines: string[] = [];
	const write = (cells: string[], index: number, header: boolean) => {
		let xml = "";
		for (let c = 0; c < cells.length; c++)
			xml += cellXml(`${columnLetters(c)}${index}`, cells[c], header);
		lines.push(`<row r="${index}">${xml}</row>`);
	};
	write(headers, 1, true);
	rows.forEach((row, i) => write(row, i + 2, false));

	const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${lines.join("")}</sheetData></worksheet>`;
	const files: Record<string, Uint8Array> = {
		"[Content_Types].xml": strToU8(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
		),
		"_rels/.rels": strToU8(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
		),
		"xl/workbook.xml": strToU8(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="${xmlAttribute(sheetName(name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
		),
		"xl/_rels/workbook.xml.rels": strToU8(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
		),
		"xl/styles.xml": strToU8(STYLES),
		"xl/worksheets/sheet1.xml": strToU8(sheet),
	};
	return zipSync(files, { level: 6 });
}
