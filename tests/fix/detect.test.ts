import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectColumns, parseNumber } from "@/lib/fix/detect";
import { ROW_LIMIT, readTable, writeCsv } from "@/lib/fix/table";

const sample = readFileSync("public/fix/sample-wards.csv", "utf8");

describe("readTable", () => {
	it("keeps cells exactly as written", () => {
		const table = readTable("code,count\n e05013408 ,1\n");
		expect(table.headers).toEqual(["code", "count"]);
		expect(table.rows).toEqual([[" e05013408 ", "1"]]);
	});

	it("reads a pasted column with no header", () => {
		const table = readTable("E05013408\nE05013471\n");
		expect(table.headers).toEqual(["area"]);
		expect(table.rows).toEqual([["E05013408"], ["E05013471"]]);
	});

	it("reads tab-separated text pasted from a spreadsheet", () => {
		const table = readTable("ward\tvalue\nE05013408\t12\n");
		expect(table.headers).toEqual(["ward", "value"]);
		expect(table.rows[0]).toEqual(["E05013408", "12"]);
	});

	it("skips a title above the header", () => {
		const table = readTable(
			"Households by ward\nward_cd,households\nE05013408,10\n",
		);
		expect(table.skippedLines).toBe(1);
		expect(table.headers).toEqual(["ward_cd", "households"]);
	});

	it("stops at the row limit and says how many rows it left out", () => {
		const rows = Array.from(
			{ length: ROW_LIMIT + 5 },
			(_, i) => `E05${String(i).padStart(6, "0")},${i}`,
		);
		const table = readTable(`code,value\n${rows.join("\n")}`);
		expect(table.rows).toHaveLength(ROW_LIMIT);
		expect(table.droppedRows).toBe(5);
	});

	it("writes CSV that reads back the same", () => {
		const csv = writeCsv(["name", "n"], [["Bradford-on-Avon, South", "1"]]);
		expect(readTable(csv).rows).toEqual([["Bradford-on-Avon, South", "1"]]);
	});
});

describe("parseNumber", () => {
	it("reads plain and grouped numbers", () => {
		expect(parseNumber("1,234")).toBe(1234);
		expect(parseNumber(" 12.5 ")).toBe(12.5);
		expect(parseNumber("-3")).toBe(-3);
	});

	it("refuses anything else", () => {
		expect(parseNumber("")).toBeNull();
		expect(parseNumber("12a")).toBeNull();
		expect(parseNumber("1,23")).toBeNull();
		expect(parseNumber("E05013408")).toBeNull();
	});
});

describe("detectColumns", () => {
	it("finds the code and value columns in the sample", () => {
		const table = readTable(sample);
		const detection = detectColumns(table);
		expect(table.headers[detection.area ?? -1]).toBe("ward_cd");
		expect(detection.kind).toBe("code");
		expect(detection.values.map((i) => table.headers[i])).toEqual([
			"households",
		]);
	});

	it("finds codes by their values, whatever the header", () => {
		const table = readTable(
			"id,label,score\nE05013408,Brinkworth,1\nE05013471,Southwick,2\n",
		);
		const detection = detectColumns(table);
		expect(detection.area).toBe(0);
		expect(detection.kind).toBe("code");
		expect(detection.values).toEqual([2]);
	});

	it("still finds a code column with a typo in it", () => {
		const table = readTable(
			"place,code\nA,E05013408\nB,E0513457\nC,E05013471\n",
		);
		expect(detectColumns(table)).toMatchObject({ area: 1, kind: "code" });
	});

	it("falls back to a name column, with a local authority as parent", () => {
		const table = readTable(
			"Ward name,Local authority,Rate\nAbbey,Shropshire,1.5\nAbbey,Merton,2\n",
		);
		expect(detectColumns(table)).toEqual({
			area: 0,
			kind: "name",
			parent: 1,
			values: [2],
		});
	});

	it("does not offer a year as a value", () => {
		const table = readTable("code,year,count\nE05013408,2024,5\n");
		expect(detectColumns(table).values).toEqual([2]);
	});

	it("finds nothing in a table without areas", () => {
		const table = readTable("a,b\n1,2\n3,4\n");
		expect(detectColumns(table)).toMatchObject({ area: null, kind: null });
	});
});
