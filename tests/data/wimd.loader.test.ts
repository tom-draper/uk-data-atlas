import { describe, expect, it } from "vitest";
import {
	publishedWIMDRanks,
	welshLSOAPopulations,
	type DatasetReader,
} from "@uk-data-atlas/datasets";
import { wimd } from "../../packages/datasets/src/society/deprivation/wimd/dataset.ts";

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

const read = (populations = populationCsv, ranks = ranksXml) =>
	wimd.statistics.direct!.read({
		text: async (path: string) =>
			path.endsWith("population-mid-2017.csv") ? populations : scoresCsv,
		odsContent: async () => ranks,
	} as unknown as DatasetReader);

describe("WIMD source reader", () => {
	it("uses published ranks and population", async () => {
		const [part] = await read();
		const first = part.records[0];
		expect(first.code).toBe("W01000001");
		expect(first.parents?.ladCode).toEqual({
			code: "W06000001",
			name: "Isle of Anglesey",
		});
		expect(first.values).toEqual([
			{ measure: "wimd-score", value: 19.2 },
			{ measure: "wimd-rank", value: 885 },
			{ measure: "wimd-decile", value: 5 },
			{ measure: "population", value: 1500 },
		]);
		expect(
			part.records[1].values.find(
				({ measure }) => measure === "wimd-rank",
			)?.value,
		).toBe(1324);
	});
	it("rejects a missing rank or population", async () => {
		const missingRank = ranksXml
			.split("\n")
			.filter((line) => !line.includes("W01000002"))
			.join("\n");
		await expect(read(populationCsv, missingRank)).rejects.toThrow(
			/no published rank for W01000002/,
		);
		const missingPopulation = populationCsv
			.split("\n")
			.filter((line) => !line.includes("W01000002"))
			.join("\n");
		await expect(read(missingPopulation)).rejects.toThrow(
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
