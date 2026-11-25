import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	csvUpload,
	MAX_BYTES,
	readUpload,
	UploadError,
	withHeader,
	withSheet,
} from "@/lib/fix/upload";

const file = (name: string, type = "") =>
	new File([readFileSync(`tests/fixtures/fix/spreadsheets/${name}`)], name, {
		type,
	});

describe("readUpload", () => {
	it("can use the first pasted name as data or choose a different header", () => {
		const upload = csvUpload(
			"Brinkworth\n\nSouthwick\nPurton",
			"pasted.csv",
		);
		expect(upload.table.headerRow).toBe(0);
		expect(withHeader(upload, null).table).toMatchObject({
			headerRow: null,
			headers: ["area"],
			rows: [["Brinkworth"], ["Southwick"], ["Purton"]],
		});
		expect(withHeader(upload, 1).table).toMatchObject({
			headerRow: 1,
			headers: ["Southwick"],
			rows: [["Purton"]],
		});
	});

	it("reads a CSV as a table with no sheets", async () => {
		const upload = await readUpload(
			new File(["code,n\nE06000022,1\n"], "a.csv"),
		);
		expect(upload.format).toBe("csv");
		expect(upload.sheets).toEqual([]);
		expect(upload.table.rows).toEqual([["E06000022", "1"]]);
	});

	it("reads a workbook from its first sheet with something in it", async () => {
		const upload = await readUpload(file("ward-blank-rows.xlsx"));
		expect(upload.format).toBe("xlsx");
		expect(upload.table.headers).toEqual([
			"ward_cd",
			"ward_name",
			"households",
		]);
		expect(upload.table.skippedLines).toBeGreaterThan(0);
	});

	it("lets another sheet be chosen without reading the file again", async () => {
		const upload = await readUpload(file("multi-sheet.xlsx"));
		expect(upload.sheets.map((s) => [s.name, s.empty])).toEqual([
			["Read me", false],
			["Scratch", true],
			["Old numbers", false],
			["Claimants", false],
			["Lookup", false],
		]);
		const claimants = withSheet(upload, 3);
		expect(claimants.sheet).toBe(3);
		expect(claimants.table.headers).toEqual([
			"Area code",
			"Area",
			"Claimants",
		]);
		expect(claimants.table.rows).toHaveLength(8);
	});

	it("reads an ods file", async () => {
		const upload = await readUpload(file("authorities.ods"));
		expect(upload.format).toBe("ods");
		expect(upload.table.headers[0]).toBe("Local authority code");
	});

	it("says so for a spreadsheet format it cannot read", async () => {
		await expect(readUpload(new File(["x"], "old.xls"))).rejects.toThrow(
			UploadError,
		);
	});

	it("says so for a file that is not the workbook its name says", async () => {
		await expect(readUpload(new File(["a,b"], "a.xlsx"))).rejects.toThrow(
			UploadError,
		);
	});

	it("refuses a file larger than the limit", async () => {
		const big = new File(["x"], "big.csv");
		Object.defineProperty(big, "size", { value: MAX_BYTES + 1 });
		await expect(readUpload(big)).rejects.toThrow(/larger than/);
	});
});
