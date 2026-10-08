import { createHash } from "crypto";
import { join } from "path";
import type { DatasetReader, SourceArtifact } from "../../lib/data/catalog";
import type { OdsTableOptions } from "../../lib/data/spreadsheet/ods";
import { fileStamp, sourceInputPath } from "./cache.mts";
import { SOURCE_DATA } from "./paths.mts";
import { readSource } from "./sources/read.mts";
import { readZip, visitCsvRows, visitZipCsvRows } from "./sources/csv.mts";
import { readOdsContent, visitOdsTableRows } from "./sources/ods.mts";
import { readXlsSheet, visitXlsSheetRows } from "./sources/xls.mts";
import {
	readXlsxSheet,
	visitXlsxSheetRows,
	visitXlsxSheetSelectedRows,
} from "./sources/xlsx.mts";

const sha256 = (content: string | Uint8Array) =>
	createHash("sha256").update(content).digest("hex");

const sizeOf = (content: string | Uint8Array) =>
	typeof content === "string"
		? Buffer.byteLength(content, "utf8")
		: content.byteLength;

// The worksheet XML alone does not fully describe an .xlsx input: values can
// be resolved through the shared-string table and percentages through styles.
// Keep all three in the tracked source artifact, so a cache hit cannot hide a
// change to either supporting file.
const xlsxRowsArtifact = (sheetPath: string) =>
	JSON.stringify({ sheetPath, streaming: true });

const xlsxSelectedRowsArtifact = (sheet: string, columns: readonly number[]) =>
	JSON.stringify({ version: 1, sheet, columns });

/**
 * A `DatasetReader` that records everything a loader reads, with a hash of
 * what it read and a stamp of the file it came from. The record is what lets a
 * later run tell whether a dataset's inputs have changed.
 */
export const createTrackedReader = () => {
	const artifacts = new Map<string, SourceArtifact>();
	/** Records an artifact read from the file at `data/<inputPath>`. */
	const record = async (
		key: string,
		kind: SourceArtifact["kind"],
		path: string,
		content: string | Uint8Array,
		inputPath: string,
	) => {
		artifacts.set(key, {
			kind,
			path,
			bytes: sizeOf(content),
			sha256: sha256(content),
			input: await fileStamp(inputPath),
		});
	};
	const track = async (
		kind: SourceArtifact["kind"],
		path: string,
		readContent: () => Promise<string>,
	) => {
		const content = await readContent();
		await record(
			`${kind}:${path}`,
			kind,
			path,
			content,
			sourceInputPath(kind, path),
		);
		return content;
	};
	const trackStream = async (
		kind: "csvRows" | "zipCsvRows",
		path: string,
		visit: () => Promise<{ bytes: number; sha256: string }>,
	) => {
		const content = await visit();
		artifacts.set(`${kind}:${path}`, {
			kind,
			path,
			...content,
			input: await fileStamp(join(SOURCE_DATA, path)),
		});
	};
	const reader: DatasetReader = {
		text: (path) => track("text", path, () => readSource(path)),
		csvRows: (path, options, visit) =>
			trackStream("csvRows", path, () =>
				visitCsvRows(path, options, visit),
			),
		xlsxSheet: (path, sheet) =>
			track("xlsxSheet", `${path}#${sheet}`, () =>
				readXlsxSheet(path, sheet),
			),
		xlsxSheetRows: async (path, sheet, visit) => {
			const input = await visitXlsxSheetRows(path, sheet, visit);
			await record(
				`xlsxSheetRows:${path}#${sheet}`,
				"xlsxSheetRows",
				`${path}#${sheet}`,
				xlsxRowsArtifact(input.sheetPath),
				join(SOURCE_DATA, path),
			);
		},
		xlsxSheetSelectedRows: async (path, sheet, columns, visit) => {
			await visitXlsxSheetSelectedRows(path, sheet, columns, visit);
			const selection = `${path}#${sheet}:${columns.join(",")}`;
			await record(
				`xlsxSheetSelectedRows:${selection}`,
				"xlsxSheetSelectedRows",
				selection,
				xlsxSelectedRowsArtifact(sheet, columns),
				join(SOURCE_DATA, path),
			);
		},
		xlsSheet: (path, sheet) =>
			track("xlsSheet", `${path}#${sheet}`, () =>
				readXlsSheet(path, sheet),
			),
		xlsSheetRows: async (path, sheet, visit) => {
			const bytes = await visitXlsSheetRows(path, sheet, visit);
			await record(
				`xlsSheetRows:${path}#${sheet}`,
				"xlsSheetRows",
				`${path}#${sheet}`,
				bytes,
				join(SOURCE_DATA, path),
			);
		},
		odsContent: (path) =>
			track("odsContent", path, () => readOdsContent(path)),
		odsTableRows: async (path, options: OdsTableOptions, visit) => {
			await visitOdsTableRows(path, options, visit);
			await record(
				`odsTableRows:${path}:${options.table}`,
				"odsTableRows",
				`${path}#${options.table}`,
				JSON.stringify({ ...options, streaming: true }),
				join(SOURCE_DATA, path),
			);
		},
		zipCsv: (path) => track("zipCsv", path, () => readZip(path)),
		zipCsvRows: (path, visit) =>
			trackStream("zipCsvRows", path, () => visitZipCsvRows(path, visit)),
	};
	return { reader, artifacts };
};
