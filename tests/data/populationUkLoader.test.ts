import { describe, expect, it } from "vitest";
import { loadPopulationUk } from "@/lib/data/population/ukLoader";

const TITLE =
	"Annual mid-year population estimates for United Kingdom local authorities (as of April 2023), by sex and single year of age";
const HEADER =
	"ladcode23,laname23,country,sex,age,population_2011,population_2012";

/** Stands in for the MYEB1 worksheet, title row and all. */
const sheet =
	(...rows: string[]) =>
	async () =>
		[TITLE, HEADER, ...rows].join("\n");

describe("loadPopulationUk", () => {
	it("emits a dataset per year and sums the sexes into the total", async () => {
		const datasets = await loadPopulationUk(
			sheet(
				"E06000001,Hartlepool,E,f,0,10,11",
				"E06000001,Hartlepool,E,m,0,20,21",
			),
		);

		expect(Object.keys(datasets)).toEqual(["2011", "2012"]);
		const dataset = datasets["2011"];
		expect(dataset.id).toBe("populationUk2011");
		expect(dataset.year).toBe(2011);
		expect(dataset.boundaryYear).toBe(2023);
		expect(dataset.boundaryType).toBe("localAuthority");
		expect(dataset.data["E06000001"]).toEqual({
			total: { "0": 30 },
			males: { "0": 20 },
			females: { "0": 10 },
			ladName: "Hartlepool",
			country: "E",
		});
		expect(datasets["2012"].data["E06000001"].total).toEqual({ "0": 32 });
	});

	it("keeps ages apart rather than collapsing them", async () => {
		const datasets = await loadPopulationUk(
			sheet(
				"W06000001,Isle of Anglesey,W,f,0,5,5",
				"W06000001,Isle of Anglesey,W,f,90,7,7",
			),
		);

		expect(datasets["2011"].data["W06000001"].females).toEqual({
			"0": 5,
			"90": 7,
		});
	});

	it("skips the footnote rows trailing the sheet", async () => {
		const datasets = await loadPopulationUk(
			sheet(
				"E06000001,Hartlepool,E,f,0,10,11",
				",,,,,,",
				"Note: these are experimental statistics,,,,,,",
				"E06000001,Hartlepool,E,x,0,99,99",
				"TOTAL,,,f,0,999,999",
			),
		);

		expect(Object.keys(datasets["2011"].data)).toEqual(["E06000001"]);
		expect(datasets["2011"].data["E06000001"].total).toEqual({ "0": 10 });
	});

	it("returns nothing when the sheet has no year columns", async () => {
		const datasets = await loadPopulationUk(
			async () => "title\nladcode23,laname23,country,sex,age\n",
		);

		expect(datasets).toEqual({});
	});
});
