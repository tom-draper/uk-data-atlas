import { describe, expect, it } from "vitest";
import { populationUkStatisticsParts } from "@uk-data-atlas/datasets";

const TITLE =
	"Annual mid-year population estimates for United Kingdom local authorities (as of April 2023), by sex and single year of age";
const HEADER =
	"ladcode23,laname23,country,sex,age,population_2011,population_2012";

/** Stands in for the MYEB1 worksheet, title row and all. */
const sheet =
	(...rows: string[]) =>
	async () =>
		[TITLE, HEADER, ...rows].join("\n");

describe("populationUkStatisticsParts", () => {
	it("emits a part per year with all, male and female counts by age", async () => {
		const parts = await populationUkStatisticsParts(
			sheet(
				"E06000001,Hartlepool,E,f,0,10,11",
				"E06000001,Hartlepool,E,m,0,20,21",
			),
		);

		expect(parts.map((part) => part.key)).toEqual(["2011", "2012"]);
		const [record] = parts[0]!.records;
		expect(record).toMatchObject({ code: "E06000001", name: "Hartlepool" });
		expect(
			record!.values.map(({ members, value }) => [
				members?.sex,
				members?.age,
				value,
			]),
		).toEqual([
			["all", "0", 30],
			["male", "0", 20],
			["female", "0", 10],
		]);
	});

	it("skips footnote rows and rows without an age", async () => {
		const parts = await populationUkStatisticsParts(
			sheet(
				"E06000001,Hartlepool,E,f,90+,5,6",
				"Source: ONS,,,,,,",
				"E06000002,Redcar,E,x,1,1,1",
			),
		);
		expect(parts).toEqual([]);
	});
});
