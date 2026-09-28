import { describe, expect, it } from "vitest";
import {
	columnIndex,
	findSheetPath,
	parseSharedStrings,
	percentageStyles,
	rowsToCsv,
	sheetRows,
} from "@/lib/data/spreadsheet/xlsx";

describe("columnIndex", () => {
	it("maps spreadsheet column letters to zero-based indexes", () => {
		expect(columnIndex("A1")).toBe(0);
		expect(columnIndex("B2")).toBe(1);
		expect(columnIndex("Z100")).toBe(25);
		expect(columnIndex("AA1")).toBe(26);
		expect(columnIndex("AB1")).toBe(27);
		expect(columnIndex("BA1")).toBe(52);
	});
});

describe("parseSharedStrings", () => {
	it("reads the table in index order", () => {
		const strings = parseSharedStrings(
			"<sst><si><t>Ward name</t></si><si><t>Electorate</t></si></sst>",
		);
		expect(strings).toEqual(["Ward name", "Electorate"]);
	});

	it("rejoins an entry split into styled runs", () => {
		const strings = parseSharedStrings(
			"<sst><si><r><t>Valid vote </t></r><r><t>turnout</t></r></si></sst>",
		);
		expect(strings).toEqual(["Valid vote turnout"]);
	});

	it("decodes escaped characters", () => {
		expect(
			parseSharedStrings(
				"<sst><si><t>Fish &amp; Chips &lt;2&gt;</t></si></sst>",
			),
		).toEqual(["Fish & Chips <2>"]);
	});
});

describe("findSheetPath", () => {
	const workbook = `<workbook><sheets>
		<sheet name="Contents" sheetId="1" r:id="rId1"/>
		<sheet name="Ward results" sheetId="2" r:id="rId4"/>
	</sheets></workbook>`;
	const rels = `<Relationships>
		<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
		<Relationship Id="rId4" Target="worksheets/sheet4.xml"/>
	</Relationships>`;

	it("resolves a sheet name through its relationship id", () => {
		expect(findSheetPath(workbook, rels, "Ward results")).toBe(
			"xl/worksheets/sheet4.xml",
		);
	});

	it("lists the sheets it does have when the name is wrong", () => {
		expect(() => findSheetPath(workbook, rels, "Wards results")).toThrow(
			/not found. The workbook has: Contents, Ward results/,
		);
	});
});

describe("sheetRows", () => {
	const strings = ["Ward", "Abbey"];

	it("resolves shared strings and reads plain numbers", () => {
		const rows = sheetRows(
			`<sheetData>
				<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>2371</v></c></row>
			</sheetData>`,
			strings,
		);
		expect(rows).toEqual([["Ward", "2371"]]);
	});

	it("places cells by reference, so a skipped column stays empty", () => {
		const rows = sheetRows(
			`<row r="1"><c r="A1" t="s"><v>1</v></c><c r="D1"><v>7</v></c></row>`,
			strings,
		);
		expect(rows).toEqual([["Abbey", "", "", "7"]]);
	});

	it("reads inline strings", () => {
		const rows = sheetRows(
			`<row r="1"><c r="A1" t="inlineStr"><is><t>Inline</t></is></c></row>`,
			strings,
		);
		expect(rows).toEqual([["Inline"]]);
	});

	it("treats an empty self-closing cell as blank", () => {
		const rows = sheetRows(
			`<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="26"/></row>`,
			strings,
		);
		expect(rows).toEqual([["Ward", ""]]);
	});

	it("reads the cell after a blank self-closing cell, not swallows it", () => {
		const rows = sheetRows(
			`<row r="1"><c r="A1" s="26"/><c r="B1" t="s"><v>0</v></c></row>`,
			strings,
		);
		expect(rows).toEqual([["", "Ward"]]);
	});

	it("scales a percentage-formatted cell to what the sheet displays", () => {
		const xml = `<row r="1"><c r="A1" s="3"><v>0.254261057173679</v></c><c r="B1" s="0"><v>0.5</v></c></row>`;
		expect(sheetRows(xml, strings, new Set([3]))).toEqual([
			["25.4261057173679", "0.5"],
		]);
	});

	it("drops the float noise a raw value can carry", () => {
		expect(
			sheetRows(
				`<row r="1"><c r="A1"><v>39.200000000000003</v></c></row>`,
				[],
			),
		).toEqual([["39.2"]]);
	});
});

describe("percentageStyles", () => {
	const styles = (numFmts: string, xfs: string) =>
		`<styleSheet>${numFmts}<cellXfs count="3">${xfs}</cellXfs></styleSheet>`;

	it("finds styles using a custom percentage format", () => {
		const found = percentageStyles(
			styles(
				`<numFmts><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>`,
				`<xf numFmtId="0"/><xf numFmtId="165"/><xf numFmtId="0"/>`,
			),
		);
		expect(found).toEqual(new Set([1]));
	});

	it("recognises the built-in percentage formats", () => {
		expect(percentageStyles(styles("", `<xf numFmtId="9"/>`))).toEqual(
			new Set([0]),
		);
	});

	it("ignores a percent sign that is only a literal in the format", () => {
		const found = percentageStyles(
			styles(
				`<numFmts><numFmt numFmtId="166" formatCode="0.0&quot;%&quot;"/></numFmts>`,
				`<xf numFmtId="166"/>`,
			),
		);
		expect(found).toEqual(new Set());
	});
});

describe("rowsToCsv", () => {
	it("quotes only the fields that need it", () => {
		expect(
			rowsToCsv([
				["Ward", "Votes"],
				["St Mary's", "1021"],
				["Ashton, North", "580"],
				['He said "no"', "0"],
			]),
		).toBe(
			`Ward,Votes\nSt Mary's,1021\n"Ashton, North",580\n"He said ""no""",0`,
		);
	});
});
