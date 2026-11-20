import { downloadBlob, derivedName } from "./report";
import { MIME, type FileFormat } from "./spreadsheet";
import { writeCsv } from "./table";

/** The file a table came from, which says what to give back. */
export interface SourceFile {
	name: string;
	format: FileFormat;
	/** The sheet read, which a spreadsheet download keeps as its sheet name. */
	sheetName: string;
}

export interface Rows {
	headers: string[];
	rows: string[][];
}

/**
 * Offers a table as a download, in the format it came in unless another is
 * asked for. A spreadsheet is built in a worker, and only on first use.
 */
export async function saveTable(
	source: SourceFile,
	{ headers, rows }: Rows,
	suffix: string,
	format: FileFormat = source.format,
): Promise<void> {
	const filename = derivedName(source.name, suffix, format);
	if (format === "csv") {
		downloadBlob(
			new Blob([writeCsv(headers, rows)], { type: MIME.csv }),
			filename,
		);
		return;
	}
	const { writeWorkbook } = await import("./spreadsheet/client");
	const bytes = await writeWorkbook(format, source.sheetName, headers, rows);
	downloadBlob(
		new Blob([bytes as BlobPart], { type: MIME[format] }),
		filename,
	);
}
