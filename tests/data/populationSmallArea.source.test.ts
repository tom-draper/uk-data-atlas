import { describe, expect, it } from "vitest";
import {
	POPULATION_LSOA_WORKBOOKS,
	populationDataZoneNiStatisticsParts,
	populationDataZoneScotlandStatisticsParts,
	populationDataZoneScotlandYear,
	populationLsoaStatisticsParts,
	populationLsoaYear,
} from "@uk-data-atlas/datasets";

type Row = ReadonlyMap<number, string>;
type Visit = (row: Row) => void;

/** A row from its cells, by column position. */
const row = (cells: Record<number, string>): Row =>
	new Map(
		Object.entries(cells).map(([column, text]) => [Number(column), text]),
	);

/** A reader serving each sheet's rows, recording what was asked for. */
const reader = (sheets: (path: string, sheet: string) => Row[]) => {
	const asked: Array<{
		path: string;
		sheet: string;
		columns: readonly number[];
	}> = [];
	const readRows = async (
		path: string,
		sheet: string,
		columns: readonly number[],
		visit: Visit,
	) => {
		asked.push({ path, sheet, columns });
		for (const cells of sheets(path, sheet)) visit(cells);
	};
	return { readRows, asked };
};

const total = (value: number) => [
	{ measure: "population", members: { sex: "all" }, value },
];

describe("ONS LSOA population", () => {
	const lsoaSheet = (rows: Row[]) => [
		row({ 0: "Mid-2022 population estimates for LSOAs" }),
		row({ 0: "This worksheet contains one table." }),
		row({
			0: "LAD 2023 Code",
			1: "LAD 2023 Name",
			2: "LSOA 2021 Code",
			3: "LSOA 2021 Name",
			4: "Total",
		}),
		...rows,
	];

	it("reads each LSOA's total from the named year's sheet", async () => {
		const { readRows, asked } = reader(() =>
			lsoaSheet([
				row({ 2: "E01000001", 3: "City of London 001A", 4: "1473" }),
				row({ 2: "W01000001", 3: "Isle of Anglesey 001A", 4: "1660" }),
				row({ 0: "Source: ONS" }),
			]),
		);
		const records = await populationLsoaYear(readRows, "lsoa.xlsx", 2022);

		expect(asked).toEqual([
			{
				path: "lsoa.xlsx",
				sheet: "Mid-2022 LSOA 2021",
				columns: [2, 3, 4],
			},
		]);
		expect([...records.values()]).toEqual([
			{
				code: "E01000001",
				name: "City of London 001A",
				values: total(1473),
			},
			{
				code: "W01000001",
				name: "Isle of Anglesey 001A",
				values: total(1660),
			},
		]);
	});

	it("refuses a sheet whose total column has moved", async () => {
		const { readRows } = reader(() => [
			row({ 2: "LSOA 2021 Code", 3: "LSOA 2021 Name", 4: "F0" }),
		]);
		await expect(
			populationLsoaYear(readRows, "lsoa.xlsx", 2022),
		).rejects.toThrow(/expected Total/);
	});

	it("refuses a missing header, a repeated LSOA and an unreadable total", async () => {
		await expect(
			populationLsoaYear(reader(() => []).readRows, "lsoa.xlsx", 2022),
		).rejects.toThrow(/no header row/);
		const twice = reader(() =>
			lsoaSheet([
				row({ 2: "E01000001", 4: "1" }),
				row({ 2: "E01000001", 4: "2" }),
			]),
		);
		await expect(
			populationLsoaYear(twice.readRows, "lsoa.xlsx", 2022),
		).rejects.toThrow(/E01000001 appears twice/);
		const blank = reader(() => lsoaSheet([row({ 2: "E01000001", 4: "" })]));
		await expect(
			populationLsoaYear(blank.readRows, "lsoa.xlsx", 2022),
		).rejects.toThrow(/unreadable population/);
	});

	it("reads every year once, the revised mid-2022 from the later workbook", async () => {
		const { readRows, asked } = reader((_path, sheet) =>
			lsoaSheet([
				row({ 2: "E01000001", 4: sheet.slice(4, 8) }),
				row({ 2: "W01000001", 4: "7" }),
			]),
		);
		const parts = await populationLsoaStatisticsParts(readRows, 2);

		expect(parts.map((part) => part.key)).toEqual(
			Array.from({ length: 14 }, (_, index) => String(2011 + index)),
		);
		const mid2022 = asked.filter(
			(request) => request.sheet === "Mid-2022 LSOA 2021",
		);
		expect(mid2022).toHaveLength(1);
		expect(mid2022[0]!.path).toMatch(/sapelsoasyoa20222024\.xlsx$/);
		expect(Object.values(POPULATION_LSOA_WORKBOOKS).flat()).toHaveLength(
			14,
		);
		expect(parts[0]!.records[0]!.values).toEqual(total(2011));
	});

	it("refuses a year that does not hold every LSOA", async () => {
		const { readRows } = reader(() =>
			lsoaSheet([row({ 2: "E01000001", 4: "1" })]),
		);
		await expect(
			populationLsoaStatisticsParts(readRows, 2),
		).rejects.toThrow(/LSOA population 2011: expected 2 areas, found 1/);
	});
});

describe("NRS Scottish data zone population", () => {
	const nrsSheet = (rows: Row[]) => [
		row({ 0: "Small area population estimates, 2022 data zones" }),
		row({
			0: "Data zone code",
			1: "Data zone name",
			4: "Sex",
			5: "Total population",
		}),
		...rows,
	];
	const zone = (code: string, sex: string, value: string) =>
		row({ 0: code, 1: `${code} name`, 4: sex, 5: value });

	it("reads the persons row of each data zone, not the sexes", async () => {
		const { readRows, asked } = reader(() =>
			nrsSheet([
				zone("S01013482", "Persons", "812"),
				zone("S01013482", "Males", "400"),
				zone("S01013482", "Females", "412"),
				zone("S01013483", "Persons", "690"),
			]),
		);
		const records = await populationDataZoneScotlandYear(
			readRows,
			"SAPE 2024.xlsx",
			2024,
		);

		expect(asked).toEqual([
			{ path: "SAPE 2024.xlsx", sheet: "2024", columns: [0, 1, 4, 5] },
		]);
		expect([...records.values()]).toEqual([
			{ code: "S01013482", name: "S01013482 name", values: total(812) },
			{ code: "S01013483", name: "S01013483 name", values: total(690) },
		]);
	});

	it("refuses a header without the sex and total columns", async () => {
		const { readRows } = reader(() => [
			row({ 0: "Data zone code", 4: "Age 0", 5: "Age 1" }),
		]);
		await expect(
			populationDataZoneScotlandYear(readRows, "SAPE 2024.xlsx", 2024),
		).rejects.toThrow(/expected Sex and Total population/);
	});

	it("reads one workbook for each year from 2011 to 2024", async () => {
		const { readRows, asked } = reader((_path, sheet) =>
			nrsSheet([zone("S01013482", "Persons", sheet)]),
		);
		const parts = await populationDataZoneScotlandStatisticsParts(
			readRows,
			1,
		);

		expect(parts.map((part) => part.key)).toEqual(
			asked.map((request) => request.sheet),
		);
		expect(asked[0]!.path).toMatch(/SAPE 2011\.xlsx$/);
		expect(asked.at(-1)!.path).toMatch(/SAPE 2024\.xlsx$/);
		expect(parts.at(-1)!.records[0]!.values).toEqual(total(2024));
	});
});

describe("NISRA Northern Ireland data zone population", () => {
	const header = row({ 0: "Area", 1: "Area_Code", 2: "Year", 3: "MYE" });
	const zone = (code: string, year: string, value: string) =>
		row({ 0: "Data Zone 2021", 1: code, 2: year, 3: value });

	it("splits the long table into one part per year, by code alone", async () => {
		const { readRows, asked } = reader(() => [
			header,
			zone("N20000001", "2021", "450"),
			zone("N20000001", "2022", "455"),
			zone("N20000002", "2022", "300"),
			zone("N20000002", "2021", "298"),
		]);
		const parts = await populationDataZoneNiStatisticsParts(
			readRows,
			2,
			"MYE24_DZ.xlsx",
		);

		expect(asked).toEqual([
			{ path: "MYE24_DZ.xlsx", sheet: "Flat", columns: [0, 1, 2, 3] },
		]);
		expect(parts).toEqual([
			{
				key: "2021",
				records: [
					{ code: "N20000001", values: total(450) },
					{ code: "N20000002", values: total(298) },
				],
			},
			{
				key: "2022",
				records: [
					{ code: "N20000001", values: total(455) },
					{ code: "N20000002", values: total(300) },
				],
			},
		]);
	});

	it("refuses a changed header and a year missing a data zone", async () => {
		const renamed = reader(() => [
			row({ 0: "Area", 1: "Code", 2: "Year", 3: "MYE" }),
		]);
		await expect(
			populationDataZoneNiStatisticsParts(renamed.readRows, 1, "x.xlsx"),
		).rejects.toThrow(/expected Area, Area_Code, Year, MYE/);
		const short = reader(() => [
			header,
			zone("N20000001", "2021", "450"),
			zone("N20000002", "2021", "298"),
			zone("N20000001", "2022", "455"),
		]);
		await expect(
			populationDataZoneNiStatisticsParts(short.readRows, 2, "x.xlsx"),
		).rejects.toThrow(/2022: expected 2 areas, found 1/);
	});
});
