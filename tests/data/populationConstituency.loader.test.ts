import { describe, expect, it } from "vitest";
import { loadPopulationConstituencyYear } from "@/lib/data/population-constituency/loader";

// Three preamble lines, then the header, then England's and Wales's rows.
const sheet = (rows: string[]) =>
	[
		"Estimates by single year of age and sex for 2025 Parliamentary Constituencies, mid-2022",
		"This worksheet contains one table.",
		"To turn off freeze panes select the 'View' ribbon",
		"PCON 2025 Code,PCON 2025 Name,Total,F0,F1",
		...rows,
	].join("\n");

describe("loadPopulationConstituencyYear", () => {
	it("reads each constituency's published total", async () => {
		const dataset = await loadPopulationConstituencyYear(
			2022,
			sheet([
				"E14001063,Aldershot,119256,678,697",
				"W07000081,Aberafan Maesteg,90000,500,510",
				"Source: ONS,,,,",
			]),
		);

		expect(dataset).toMatchObject({
			type: "populationConstituency",
			year: 2022,
			boundaryType: "constituency",
			boundaryYear: 2024,
		});
		expect(dataset.data.E14001063).toEqual({
			constituencyCode: "E14001063",
			constituencyName: "Aldershot",
			total: 119256,
		});
		expect(Object.keys(dataset.data)).toEqual(["E14001063", "W07000081"]);
	});

	it("refuses a constituency with no usable total", async () => {
		await expect(
			loadPopulationConstituencyYear(
				2022,
				sheet(["E14001063,Aldershot,,1,2"]),
			),
		).rejects.toThrow(/unreadable total for E14001063/);
	});
});
