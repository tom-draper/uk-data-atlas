import { execSync, spawn } from "child_process";
import { stat } from "fs/promises";
import { join } from "path";
import {
	findSheetPath,
	parseSharedStrings,
	percentageStyles,
	rowsToCsv,
	selectedSheetRow,
	sheetRow,
	sheetRows,
} from "../../../lib/data/spreadsheet/xlsx";
import { SOURCE_DATA } from "../paths.mts";

const MEGABYTE = 1024 * 1024;

/** Reads one member of the workbook's zip archive as text. */
const workbookEntry = (fullPath: string, maxBuffer: number) => {
	return (name: string) =>
		execSync(`unzip -p "${fullPath}" "${name}"`, { maxBuffer }).toString(
			"utf8",
		);
};

type WorkbookEntry = ReturnType<typeof workbookEntry>;

const locateSheet = (entry: WorkbookEntry, sheetName: string) =>
	findSheetPath(
		entry("xl/workbook.xml"),
		entry("xl/_rels/workbook.xml.rels"),
		sheetName,
	);

// Not every workbook has a shared string table.
const readSharedStrings = (entry: WorkbookEntry) => {
	try {
		return parseSharedStrings(entry("xl/sharedStrings.xml"));
	} catch {
		return [];
	}
};

// Percentage-styled cells store their fraction (0.756), not the displayed
// number (75.6), so the styles need reading too or every percentage comes out
// a hundred times too small.
const readPercentStyles = (entry: WorkbookEntry) =>
	percentageStyles(entry("xl/styles.xml"));

/**
 * Pulls one named worksheet out of an .xlsx and renders it as CSV, so the
 * workbook can stay in data/ exactly as published and no extracted copy has to
 * be committed alongside it.
 */
export const readXlsxSheet = async (
	path: string,
	sheetName: string,
): Promise<string> => {
	const fullPath = join(SOURCE_DATA, path);
	await stat(fullPath);
	const entry = workbookEntry(fullPath, 512 * MEGABYTE);
	const sheetPath = locateSheet(entry, sheetName);
	const sharedStrings = readSharedStrings(entry);
	const percentStyleIds = readPercentStyles(entry);
	return rowsToCsv(
		sheetRows(entry(sheetPath), sharedStrings, percentStyleIds),
	);
};

/**
 * Streams a worksheet's XML out of the archive and hands each `<row>` element
 * to `visitRow`, so a sheet too large to hold as a string can still be read.
 */
const streamSheetRows = (
	fullPath: string,
	sheetPath: string,
	label: string,
	visitRow: (rowXml: string) => void,
) =>
	new Promise<void>((resolve, reject) => {
		const unzip = spawn("unzip", ["-p", fullPath, sheetPath]);
		if (!unzip.stdout) {
			reject(new Error(`Could not stream ${label}.`));
			return;
		}
		unzip.stdout.setEncoding("utf8");
		let pending = "";
		let failed = false;
		const fail = (error: unknown) => {
			if (failed) return;
			failed = true;
			unzip.kill();
			reject(error);
		};
		const consume = () => {
			while (true) {
				const start = pending.search(/<row\b/);
				if (start === -1) {
					pending = pending.slice(-4);
					return;
				}
				if (start > 0) pending = pending.slice(start);
				const closing = pending.indexOf("</row>");
				const selfClosing = /^<row\b[^>]*\/>/.exec(pending)?.[0];
				if (closing === -1 && !selfClosing) return;
				const rowXml = selfClosing ?? pending.slice(0, closing + 6);
				pending = pending.slice(rowXml.length);
				visitRow(rowXml);
			}
		};
		unzip.stdout.on("data", (chunk: string) => {
			try {
				pending += chunk;
				consume();
			} catch (error) {
				fail(error);
			}
		});
		unzip.on("error", fail);
		unzip.on("close", (code) => {
			if (failed) return;
			try {
				consume();
				if (code !== 0) throw new Error(`Could not stream ${label}.`);
				resolve();
			} catch (error) {
				fail(error);
			}
		});
	});

/** Visits every row of a worksheet. Returns the sheet's path in the archive. */
export const visitXlsxSheetRows = async (
	path: string,
	sheetName: string,
	visit: (row: ReadonlyMap<number, string>) => void,
) => {
	const fullPath = join(SOURCE_DATA, path);
	await stat(fullPath);
	const entry = workbookEntry(fullPath, 64 * MEGABYTE);
	const sheetPath = locateSheet(entry, sheetName);
	const sharedStrings = readSharedStrings(entry);
	const percentStyleIds = readPercentStyles(entry);
	await streamSheetRows(
		fullPath,
		sheetPath,
		`${path}#${sheetName}`,
		(rowXml) => visit(sheetRow(rowXml, sharedStrings, percentStyleIds)),
	);
	return { sheetPath };
};

/** Visits every row of a worksheet, decoding only the named columns. */
export const visitXlsxSheetSelectedRows = async (
	path: string,
	sheetName: string,
	columns: readonly number[],
	visit: (row: ReadonlyMap<number, string>) => void,
) => {
	const fullPath = join(SOURCE_DATA, path);
	await stat(fullPath);
	const entry = workbookEntry(fullPath, 64 * MEGABYTE);
	const sheetPath = locateSheet(entry, sheetName);
	const sharedStrings = readSharedStrings(entry);
	const selectedColumns = new Set(columns);
	await streamSheetRows(
		fullPath,
		sheetPath,
		`${path}#${sheetName}`,
		(rowXml) =>
			visit(selectedSheetRow(rowXml, sharedStrings, selectedColumns)),
	);
};
