import { describe, expect, it } from "vitest";
import {
	COUNCIL_AREA_CURRENT_CODE,
	populationCouncilScotlandStatisticsParts,
	populationDistrictNiStatisticsParts,
} from "@uk-data-atlas/datasets";

const AGES = Array.from({ length: 90 }, (_, age) => String(age));

/** Stands in for NRS's Table 1: a title row, then the header, then areas. */
const nrsSheet =
	(...rows: string[][]) =>
	async () =>
		[
			["Mid-year population estimates, Scotland"],
			[
				"Area code",
				"Area name",
				"Sex",
				"Year",
				"All ages",
				...AGES,
				"90 and over",
			],
			...rows,
		]
			.map((row) => row.join(","))
			.join("\n");

/** One row of ones, with `first` as the count at age 0. */
const nrsRow = (
	code: string,
	sex: string,
	year: string,
	first = "1",
	name = "Aberdeen City",
) => [code, name, sex, year, "91", first, ...AGES.slice(1).map(() => "1"), "1"];

const niSheet =
	(...rows: string[][]) =>
	async () =>
		[["area_code", "area_name", "year", "sex", "age", "MYE"], ...rows]
			.map((row) => row.join(","))
			.join("\n");

describe("populationCouncilScotlandStatisticsParts", () => {
	it("emits a part per year with 91 ages for all, male and female", async () => {
		const parts = await populationCouncilScotlandStatisticsParts(
			nrsSheet(
				nrsRow("S12000033", "Persons", "2020", "5"),
				nrsRow("S12000033", "Males", "2020", "3"),
				nrsRow("S12000033", "Females", "2020", "2"),
				nrsRow("S12000033", "Persons", "2021", "6"),
				nrsRow("S12000033", "Males", "2021", "3"),
				nrsRow("S12000033", "Females", "2021", "3"),
			),
			"unused.xlsx",
		);
		expect(parts.map((part) => part.key)).toEqual(["2020", "2021"]);
		const [record] = parts[0]!.records;
		expect(record).toMatchObject({
			code: "S12000033",
			name: "Aberdeen City",
		});
		expect(record!.values).toHaveLength(273);
		const at = (sex: string, age: string) =>
			record!.values.find(
				(value) =>
					value.members?.sex === sex && value.members?.age === age,
			)?.value;
		expect([at("all", "0"), at("male", "0"), at("female", "0")]).toEqual([
			5, 3, 2,
		]);
		expect(at("all", "90")).toBe(1);
	});

	it("files an area under the code it has now, and leaves out Scotland", async () => {
		const parts = await populationCouncilScotlandStatisticsParts(
			nrsSheet(
				nrsRow("S12000001", "Persons", "1990"),
				nrsRow("S92000003", "Persons", "1990", "9", "Scotland"),
			),
			"unused.xlsx",
		);
		expect(parts[0]!.records.map((record) => record.code)).toEqual([
			"S12000033",
		]);
		expect(COUNCIL_AREA_CURRENT_CODE.S12000044).toBe("S12000050");
		expect(COUNCIL_AREA_CURRENT_CODE.S12000046).toBe("S12000049");
	});

	it("refuses two rows for one area, sex and year", async () => {
		await expect(
			populationCouncilScotlandStatisticsParts(
				nrsSheet(
					nrsRow("S12000044", "Persons", "2015"),
					nrsRow("S12000050", "Persons", "2015"),
				),
				"unused.xlsx",
			),
		).rejects.toThrow(/two all rows for 2015/);
	});

	it("refuses a count that is not a whole number", async () => {
		await expect(
			populationCouncilScotlandStatisticsParts(
				nrsSheet(nrsRow("S12000033", "Persons", "2020", "12.5")),
				"unused.xlsx",
			),
		).rejects.toThrow(/not a whole number/);
	});

	it("refuses a sheet whose ages are not 0 to 90", async () => {
		await expect(
			populationCouncilScotlandStatisticsParts(
				async () =>
					"Area code,Area name,Sex,Year,0,1\nS12000033,A,Persons,2020,1,1",
				"unused.xlsx",
			),
		).rejects.toThrow(/expected 91 age columns/);
	});
});

describe("populationDistrictNiStatisticsParts", () => {
	it("emits a part per year with all, male and female counts by age", async () => {
		const parts = await populationDistrictNiStatisticsParts(
			niSheet(
				[
					"N09000001",
					"Antrim and Newtownabbey",
					"2001",
					"All persons",
					"0",
					"10",
				],
				[
					"N09000001",
					"Antrim and Newtownabbey",
					"2001",
					"Males",
					"0",
					"6",
				],
				[
					"N09000001",
					"Antrim and Newtownabbey",
					"2001",
					"Females",
					"0",
					"4",
				],
				[
					"N09000001",
					"Antrim and Newtownabbey",
					"2002",
					"All persons",
					"90",
					"7",
				],
				[
					"N92000002",
					"Northern Ireland",
					"2001",
					"All persons",
					"0",
					"99",
				],
			),
			"unused.xlsx",
		);
		expect(parts.map((part) => part.key)).toEqual(["2001", "2002"]);
		expect(parts[0]!.records).toHaveLength(1);
		expect(
			parts[0]!.records[0]!.values.map(({ members, value }) => [
				members?.sex,
				members?.age,
				value,
			]),
		).toEqual([
			["all", "0", 10],
			["male", "0", 6],
			["female", "0", 4],
		]);
		expect(parts[1]!.records[0]!.values[0]!.members).toEqual({
			sex: "all",
			age: "90",
		});
	});

	it("refuses an age above 90 and a repeated row", async () => {
		await expect(
			populationDistrictNiStatisticsParts(
				niSheet(["N09000001", "A", "2001", "All persons", "91", "1"]),
				"unused.xlsx",
			),
		).rejects.toThrow(/not 0 to 90/);
		const row = ["N09000001", "A", "2001", "Males", "3", "1"];
		await expect(
			populationDistrictNiStatisticsParts(
				niSheet(row, row),
				"unused.xlsx",
			),
		).rejects.toThrow(/two male rows/);
	});
});
