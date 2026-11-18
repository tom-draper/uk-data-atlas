import { describe, expect, it } from "vitest";
import { populationConstituencyYear } from "@uk-data-atlas/datasets";

// Three preamble lines, then the header, then England's and Wales's rows.
const sheet = (rows: string[]) =>
	[
		"Estimates by single year of age and sex for 2025 Parliamentary Constituencies, mid-2022",
		"This worksheet contains one table.",
		"To turn off freeze panes select the 'View' ribbon",
		"PCON 2025 Code,PCON 2025 Name,Total,F0,F1",
		...rows,
	].join("\n");

describe("populationConstituencyYear", () => {
	it("reads each constituency's published total", async () => {
		const part = await populationConstituencyYear(
			2022,
			sheet([
				"E14001063,Aldershot,119256,678,697",
				"W07000081,Aberafan Maesteg,90000,500,510",
				"Source: ONS,,,,",
			]),
		);

		expect(part.key).toBe("2022");
		expect(part.records).toEqual([
			{
				code: "E14001063",
				name: "Aldershot",
				values: [{ measure: "population", value: 119256 }],
			},
			{
				code: "W07000081",
				name: "Aberafan Maesteg",
				values: [{ measure: "population", value: 90000 }],
			},
		]);
	});

	it("refuses a constituency with no usable total", async () => {
		await expect(
			populationConstituencyYear(
				2022,
				sheet(["E14001063,Aldershot,,1,2"]),
			),
		).rejects.toThrow(/unreadable total for E14001063/);
	});
});
