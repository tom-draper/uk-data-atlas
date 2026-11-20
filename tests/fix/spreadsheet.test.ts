import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	defaultSheet,
	formatOf,
	isUnreadableSpreadsheet,
	readSpreadsheet,
	writeSpreadsheet,
	type SpreadsheetFormat,
} from "@/lib/fix/spreadsheet";
import { tableFromLines } from "@/lib/fix/table";

const bytes = (name: string) =>
	new Uint8Array(readFileSync(`tests/fixtures/fix/spreadsheets/${name}`));

const read = (name: string, format: SpreadsheetFormat, max = 1000) =>
	readSpreadsheet(bytes(name), format, max);

describe("formatOf", () => {
	it("names the formats we can read, whatever the case", () => {
		expect(formatOf("a.XLSX")).toBe("xlsx");
		expect(formatOf("a.xlsm")).toBe("xlsx");
		expect(formatOf("a.ods")).toBe("ods");
		expect(formatOf("a.csv")).toBe("csv");
		expect(formatOf("a.tsv")).toBe("csv");
		expect(formatOf("a.pdf")).toBeNull();
	});

	it("knows spreadsheets it cannot read", () => {
		expect(isUnreadableSpreadsheet("old.xls")).toBe(true);
		expect(isUnreadableSpreadsheet("a.xlsx")).toBe(false);
	});
});

describe("readSpreadsheet, xlsx", () => {
	it("reads a title above a header on row 4, and finds the header", () => {
		const sheet = read("analyst-lsoa.xlsx", "xlsx").sheets[0];
		expect(sheet.name).toBe("Households 2011");
		const table = tableFromLines(sheet.rows);
		expect(table.headers).toEqual([
			"LSOA11CD",
			"LSOA11NM",
			"Population",
			"Households",
			"Surveyed",
			"Share",
		]);
		expect(table.skippedLines).toBeGreaterThan(0);
		expect(table.rows).toHaveLength(12);
	});

	it("keeps a number stored as text and a number the same, and typos as typed", () => {
		const table = tableFromLines(
			read("analyst-lsoa.xlsx", "xlsx").sheets[0].rows,
		);
		expect(table.rows[0].slice(0, 4)).toEqual([
			"E01000001",
			"City of London 001A",
			"1500",
			"600",
		]);
		expect(table.rows[1][2]).toBe("1537");
		// Lower case with a trailing space, a letter O for zero, and a name.
		expect(table.rows[3][0]).toBe("e01000005 ");
		expect(table.rows[5][0]).toMatch(/O/);
		expect(table.rows[7][0]).toBe("Barking and Dagenham 016B");
	});

	it("reads dates as ISO dates, and a formula's cached value", () => {
		const table = tableFromLines(
			read("analyst-lsoa.xlsx", "xlsx").sheets[0].rows,
		);
		expect(table.rows[0][4]).toBe("2011-03-27");
		expect(Number(table.rows[0][5])).toBeCloseTo(0.0757, 3);
	});

	it("reads dates in a workbook on the 1904 system", () => {
		const sheet = read("dates-1904.xlsx", "xlsx").sheets[0];
		expect(sheet.rows[1]).toEqual(["E06000022", "2021-03-21"]);
	});

	it("skips blank rows and merged cells above the header (a file from another writer)", () => {
		const sheet = read("ward-blank-rows.xlsx", "xlsx").sheets[0];
		const table = tableFromLines(sheet.rows);
		expect(table.headers).toEqual(["ward_cd", "ward_name", "households"]);
		expect(table.rows[0]).toEqual([
			"E05013400",
			"Amesbury East & Bulford",
			"3422",
		]);
	});

	it("keeps line breaks and spaces inside a cell", () => {
		const sheet = read("ward-blank-rows.xlsx", "xlsx").sheets[0];
		const row = sheet.rows.find((r) => r[0]?.startsWith("Line one"));
		expect(row?.[0]).toBe("Line one\nline two");
		expect(row?.[1]).toBe("  padded  ");
	});

	it("reads every sheet, and opens the first visible one that looks like a table", () => {
		const workbook = read("multi-sheet.xlsx", "xlsx");
		expect(workbook.sheets.map((s) => [s.name, s.hidden])).toEqual([
			["Read me", false],
			["Scratch", false],
			["Old numbers", true],
			["Claimants", false],
			["Lookup", false],
		]);
		// The cover sheet has a few cells but is one column of notes.
		expect(defaultSheet(workbook)).toBe(3);
		expect(workbook.sheets[3].rows[0]).toEqual([
			"Area code",
			"Area",
			"Claimants",
		]);
	});

	it("opens the first sheet with anything when none looks like a table", () => {
		const workbook = read("multi-sheet.xlsx", "xlsx");
		const notes = {
			...workbook,
			sheets: [workbook.sheets[1], workbook.sheets[0]],
		};
		expect(defaultSheet(notes)).toBe(1);
	});

	it("stops at the row limit and counts what it left out", () => {
		const sheet = read("analyst-lsoa.xlsx", "xlsx", 6).sheets[0];
		expect(sheet.rows).toHaveLength(6);
		expect(sheet.extraRows).toBe(10); // 16 rows in the sheet
	});

	it("rejects a file that is not a workbook", () => {
		expect(() =>
			readSpreadsheet(new TextEncoder().encode("a,b\n1,2\n"), "xlsx", 10),
		).toThrow();
		expect(() =>
			readSpreadsheet(bytes("authorities.ods"), "xlsx", 10),
		).toThrow();
	});
});

describe("readSpreadsheet, ods", () => {
	it("reads a header on row 3, numbers, percentages and dates", () => {
		const sheet = read("authorities.ods", "ods").sheets[0];
		const table = tableFromLines(sheet.rows);
		expect(table.headers).toEqual([
			"Local authority code",
			"Local authority",
			"Claimants",
			"Rate",
			"As at",
		]);
		expect(table.rows).toHaveLength(8);
		expect(table.rows[2]).toEqual([
			"E06000058",
			"Bournemouth, Christchurch and Poole",
			"9876",
			"0.0412",
			"2021-12-01",
		]);
	});

	it("does not expand the million blank rows LibreOffice leaves at the end", () => {
		const sheet = read("authorities.ods", "ods").sheets[0];
		expect(sheet.rows.length).toBeLessThan(20);
		expect(sheet.extraRows).toBe(0);
	});

	it("rejects a workbook read as the wrong format", () => {
		expect(() =>
			readSpreadsheet(bytes("multi-sheet.xlsx"), "ods", 10),
		).toThrow();
	});
});

describe("writeSpreadsheet", () => {
	const headers = ["code", "name", "count", "when", "note"];
	const rows = [
		[
			"E06000022",
			"Bath & North East <Somerset>",
			"4312",
			"2021-12-01",
			"kept",
		],
		[
			"00123",
			"Leading zeros stay text",
			"-1.5",
			"not a date",
			"line\nbreak",
		],
		["E06000024", "  spaced  ", "1e3", "2021-02-30", 'quote " here'],
	];

	for (const format of ["xlsx", "ods"] as const) {
		it(`round-trips a table through ${format}`, () => {
			const file = writeSpreadsheet(format, "Corrected", headers, rows);
			const workbook = readSpreadsheet(file, format, 100);
			expect(workbook.format).toBe(format);
			expect(workbook.sheets).toHaveLength(1);
			expect(workbook.sheets[0].name).toBe("Corrected");
			expect(workbook.sheets[0].rows).toEqual([headers, ...rows]);
		});

		it(`keeps ${format} text that only looks like a number as text`, () => {
			const file = writeSpreadsheet(
				format,
				"Sheet1",
				["code"],
				[["00123"], ["1e3"], ["0x1F"], ["12345678901234567890"]],
			);
			expect(
				readSpreadsheet(file, format, 10).sheets[0].rows.slice(1),
			).toEqual([["00123"], ["1e3"], ["0x1F"], ["12345678901234567890"]]);
		});

		it(`round-trips an empty table and a wide one through ${format}`, () => {
			const wide = Array.from({ length: 40 }, (_, i) => `c${i}`);
			const file = writeSpreadsheet(format, "Wide", wide, [
				wide.map((_, i) => String(i)),
			]);
			expect(readSpreadsheet(file, format, 10).sheets[0].rows).toEqual([
				wide,
				wide.map((_, i) => String(i)),
			]);
			const none = writeSpreadsheet(format, "None", ["a", "b"], []);
			expect(readSpreadsheet(none, format, 10).sheets[0].rows).toEqual([
				["a", "b"],
			]);
		});

		it(`cleans a sheet name for ${format}`, () => {
			const file = writeSpreadsheet(
				format,
				"A very long name: with [bad] chars / and more than thirty one",
				["a"],
				[["1"]],
			);
			const name = readSpreadsheet(file, format, 10).sheets[0].name;
			expect(name.length).toBeLessThanOrEqual(31);
			expect(name).not.toMatch(/[:\\/?*[\]]/);
		});
	}

	it("round-trips every row of a table with tens of thousands of rows", () => {
		const many = Array.from({ length: 40_000 }, (_, i) => [
			`E01${String(i).padStart(6, "0")}`,
			String(i),
		]);
		const file = writeSpreadsheet("xlsx", "Big", ["code", "n"], many);
		const sheet = readSpreadsheet(file, "xlsx", 100_000).sheets[0];
		expect(sheet.rows).toHaveLength(40_001);
		expect(sheet.rows[40_000]).toEqual(many[39_999]);
	});
});

describe("files from other writers survive a read and write", () => {
	it("gives back what it read from an analyst's workbook", () => {
		const first = read("analyst-lsoa.xlsx", "xlsx").sheets[0];
		const table = tableFromLines(first.rows);
		const file = writeSpreadsheet(
			"xlsx",
			first.name,
			table.headers,
			table.rows,
		);
		const again = readSpreadsheet(file, "xlsx", 1000).sheets[0];
		expect(tableFromLines(again.rows)).toEqual({
			...table,
			skippedLines: 0,
		});
	});
});
