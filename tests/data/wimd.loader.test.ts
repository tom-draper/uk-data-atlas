import { describe, expect, it } from "vitest";
import {
	loadWIMD,
	publishedWIMDRanks,
	welshLSOAPopulations,
} from "@/lib/data/wimd/loader";

const cell = (value: string) =>
	`<table:table-cell office:value-type="string"><text:p>${value}</text:p></table:table-cell>`;
const row = (...values: string[]) =>
	`<table:table-row>${values.map(cell).join("")}</table:table-row>`;

const ranksXml = `<table:table table:name="Deciles_quintiles_quartiles">
${row("WIMD 2019: LSOA overall rank, decile, quintile and quartile")}
${row("LSOA code", "LSOA name (Eng)", "Local Authority name (Eng)", "WIMD 2019 overall rank", "WIMD 2019 overall decile", "WIMD 2019 overall quintile", "WIMD 2019 overall quartile")}
${row("W01000001", "Aberffraw & Rhosneigr 1", "Isle of Anglesey", "885", "5", "3", "2")}
${row("W01000002", "Aberffraw & Rhosneigr 2", "Isle of Anglesey", "1324", "7", "4", "3")}
</table:table>`;

// The scores sheet rounds to one decimal place, so these two tie on score
// while their published ranks differ.
const scoresCsv = `WIMD 2019: LSOA index and domain scores,,
This worksheet contains one table.,,
Please see guidance sheet,,
LSOA code,LSOA name,Local Authority name ,WIMD 2019 
W01000001,Aberffraw & Rhosneigr 1,Isle of Anglesey,19.2
W01000002,Aberffraw & Rhosneigr 2,Isle of Anglesey,19.2
`;

const populationCsv = `"DATE_NAME","GEOGRAPHY_CODE","GEOGRAPHY_NAME","OBS_VALUE"
"2017","W01000001","Isle of Anglesey 001A",1500
"2017","W01000002","Isle of Anglesey 001B",500
`;

const read =
	(populations = populationCsv) =>
	async (path: string) =>
		path.endsWith("population-mid-2017.csv") ? populations : scoresCsv;

describe("loadWIMD", () => {
	it("reads the published rank and decile rather than re-ranking scores", async () => {
		const datasets = await loadWIMD(read(), ranksXml);
		const data = datasets[2019].data;

		expect(data.W01000001).toMatchObject({ wimdRank: 885, wimdDecile: 5 });
		expect(data.W01000002).toMatchObject({ wimdRank: 1324, wimdDecile: 7 });
		expect(data.W01000001.wimdScore).toBe(19.2);
	});

	it("refuses an LSOA with no published rank", async () => {
		const missing = ranksXml
			.split("\n")
			.filter((line) => !line.includes("W01000002"))
			.join("\n");
		await expect(loadWIMD(read(), missing)).rejects.toThrow(
			/no published rank for W01000002/,
		);
	});

	it("gives each LSOA its population and each authority a weighted average score", async () => {
		const [dataset] = Object.values(await loadWIMD(read(), ranksXml));
		expect(dataset!.data.W01000001!.population).toBe(1500);
		expect(dataset!.ladStats.W06000001).toMatchObject({
			areaCount: 2,
			population: 2000,
			averageScore: 19.2,
		});
	});

	it("refuses an LSOA with no population estimate", async () => {
		const missing = populationCsv
			.split("\n")
			.filter((line) => !line.includes("W01000002"))
			.join("\n");
		await expect(loadWIMD(read(missing), ranksXml)).rejects.toThrow(
			/no estimate for W01000002/,
		);
	});
});

describe("welshLSOAPopulations", () => {
	it("reads the Nomis extract by LSOA code", () => {
		expect(welshLSOAPopulations(populationCsv)).toEqual(
			new Map([
				["W01000001", 1500],
				["W01000002", 500],
			]),
		);
	});
});

describe("publishedWIMDRanks", () => {
	it("skips the preamble and header rows", () => {
		expect([...publishedWIMDRanks(ranksXml).keys()]).toEqual([
			"W01000001",
			"W01000002",
		]);
	});
});
