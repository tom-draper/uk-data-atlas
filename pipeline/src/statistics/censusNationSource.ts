import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { csvFields } from "@uk-data-atlas/artifacts";
import {
	findSheetPath,
	parseSharedStrings,
	sheetRows,
	sourceDir,
} from "@uk-data-atlas/datasets";
import type { CensusNationTable } from "./censusNationTables.ts";

/**
 * The data zones each nation's census files cover: the code pattern and how
 * many there are, so a file that is cut short or that holds another geography
 * is refused.
 */
export const CENSUS_NATION_AREAS = {
	scotland: { pattern: /^S01\d{6}$/, count: 7_392, boundaryYear: 2022 },
	"northern-ireland": {
		pattern: /^N20\d{6}$/,
		count: 3_780,
		boundaryYear: 2021,
	},
} as const;

const MAX_BUFFER = 512 * 1024 * 1024;

/** One file from inside a zip, which `unzip` streams without extracting. */
const unzipEntry = (archive: string, entry: string) =>
	execFileSync("unzip", ["-p", archive, entry], { maxBuffer: MAX_BUFFER });

const sorted = <Row extends [string, ...number[]]>(rows: Row[]) =>
	rows.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

/**
 * A count as the nations publish it. Both apply statistical disclosure
 * control, and Scotland shows a count removed or nil as a dash. A dash is read
 * as zero: where a table gives a household and a communal figure, the two add
 * to the total in all but a handful of data zones, none of them short.
 */
const count = (text: string | undefined, where: string) => {
	const value = text?.trim();
	if (value === "-") return 0;
	const parsed = Number(value);
	if (
		value === undefined ||
		value === "" ||
		!Number.isInteger(parsed) ||
		parsed < 0
	)
		throw new Error(`${where}: ${JSON.stringify(text)} is not a count`);
	return parsed;
};

/**
 * Scotland's long-format CSV: a data zone code, one or more labels, then the
 * count. A row is found by its labels joined with `|`.
 */
export const scotlandRecords = (
	csv: string,
	table: CensusNationTable,
): [string, ...number[]][] => {
	const { pattern, count: expected } = CENSUS_NATION_AREAS.scotland;
	const wanted = new Map(
		table.categories.map(([, key], index) => [key, index]),
	);
	const byArea = new Map<string, number[]>();
	for (const line of csv.replace(/^﻿/, "").split(/\r?\n/)) {
		if (!line.startsWith('"S')) continue;
		const fields = csvFields(line);
		const code = fields[0] ?? "";
		if (!pattern.test(code)) continue;
		const index = wanted.get(fields.slice(1, -1).join("|"));
		if (index === undefined) continue;
		const row = byArea.get(code) ?? [];
		const where = `${table.dataset} ${code} ${fields.slice(1, -1).join("|")}`;
		if (row[index] !== undefined) throw new Error(`${where} repeats`);
		row[index] = count(fields.at(-1), where);
		byArea.set(code, row);
	}
	return checked(table, byArea, expected);
};

const checked = (
	table: CensusNationTable,
	byArea: Map<string, number[]>,
	expected: number,
) => {
	if (byArea.size !== expected)
		throw new Error(
			`${table.dataset}: ${byArea.size} data zones, expected ${expected}`,
		);
	return sorted(
		[...byArea].map(([code, row]) => {
			for (const [index, [, key]] of table.categories.entries())
				if (row[index] === undefined)
					throw new Error(
						`${table.dataset} ${code}: no row for ${key}`,
					);
			return [code, ...row] as [string, ...number[]];
		}),
	);
};

/**
 * A Northern Ireland workbook's `DZ` sheet: a heading row naming each
 * category, then a row per data zone.
 */
export const northernIrelandRecords = (
	rows: readonly (readonly string[])[],
	table: CensusNationTable,
): [string, ...number[]][] => {
	const { pattern, count: expected } =
		CENSUS_NATION_AREAS["northern-ireland"];
	const header = rows.findIndex(
		(row) => row[1]?.trim().toLowerCase() === "geography code",
	);
	if (header === -1)
		throw new Error(`${table.dataset}: no heading row with Geography code`);
	const headings = rows[header]!.map((cell) => cell.trim());
	const columns = table.categories.map(([, key]) => {
		const column = headings.indexOf(key);
		if (column === -1)
			throw new Error(`${table.dataset}: no column ${key}`);
		return column;
	});
	const byArea = new Map<string, number[]>();
	for (const row of rows.slice(header + 1)) {
		const code = row[1]?.trim() ?? "";
		if (!pattern.test(code)) continue;
		if (byArea.has(code))
			throw new Error(`${table.dataset}: ${code} repeats`);
		byArea.set(
			code,
			columns.map((column) =>
				count(
					row[column],
					`${table.dataset} ${code} ${headings[column]}`,
				),
			),
		);
	}
	return checked(table, byArea, expected);
};

/** The workbook's data zone sheet as rows of text, read through `unzip`. */
const dataZoneSheet = (workbook: Buffer) => {
	// `unzip` needs a file to open, and the workbook is one inside another zip.
	const directory = mkdtempSync(join(tmpdir(), "census-ni-"));
	try {
		const path = join(directory, "workbook.xlsx");
		writeFileSync(path, workbook);
		const part = (name: string) => unzipEntry(path, name).toString("utf8");
		const sheet = findSheetPath(
			part("xl/workbook.xml"),
			part("xl/_rels/workbook.xml.rels"),
			"DZ",
		);
		return sheetRows(
			part(sheet),
			parseSharedStrings(part("xl/sharedStrings.xml")),
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
};

/**
 * A nation table's counts by data zone, in area code order, one count per
 * category in the table's category order, with a fingerprint of the file they
 * came from. Not checked to add to the total: both nations apply statistical
 * disclosure control, so the cells need not.
 */
export const censusNationRecords = (
	repositoryRoot: string,
	table: CensusNationTable,
) => {
	const archive = join(
		repositoryRoot,
		"data/source",
		sourceDir(table.folder),
		table.archive,
	);
	const bytes = unzipEntry(archive, table.entry);
	return {
		fingerprint: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
		records:
			table.nation === "scotland"
				? scotlandRecords(bytes.toString("utf8"), table)
				: northernIrelandRecords(dataZoneSheet(bytes), table),
	};
};
