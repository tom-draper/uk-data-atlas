import { describe, expect, it } from "vitest";
import {
	publishedSIMDRanks,
	type DatasetReader,
} from "@uk-data-atlas/datasets";
import { simd } from "../../packages/datasets/src/society/deprivation/simd/dataset.ts";

const lookup = `DZ,DZname,SIMD2020v2_Rank,SIMD2020v2_Vigintile,SIMD2020v2_Decile,SIMD2020v2_Quintile,LAcode,LAname
S01006506,Culter - 01,4691,14,7,4,S12000033,Aberdeen City
S01010891,Greenock Town Centre and East Central - 01,1,1,1,1,S12000018,Inverclyde
`;
const indicators = `Data_Zone,Intermediate_Zone,Council_area,Income_rate,Employment_rate
S01006506,Culter,Aberdeen City,99%,99%
S01010891,Greenock Town Centre and East Central,Inverclyde,0%,0%
`;
const read = (input = indicators, ranks = lookup) =>
	simd.statistics.direct!.read({
		text: async () => input,
		xlsxSheet: async () => ranks,
	} as unknown as DatasetReader);

describe("SIMD source reader", () => {
	it("uses the published lookup for ranks and council codes", async () => {
		const [part] = await read();
		expect(part.records[0]).toEqual({
			code: "S01006506",
			name: "Culter",
			parents: {
				councilAreaCode: { code: "S12000033", name: "Aberdeen City" },
			},
			values: [
				{ measure: "simd-rank", value: 4691 },
				{ measure: "simd-quintile", value: 4 },
				{ measure: "simd-decile", value: 7 },
			],
		});
	});
	it("uses council codes from the lookup rather than the name", async () => {
		const [part] = await read(
			indicators.replace("Inverclyde", "Fife"),
			lookup.replace("S12000018,Inverclyde", "S12000047,Fife"),
		);
		expect(part.records[1].parents?.councilAreaCode).toEqual({
			code: "S12000047",
			name: "Fife",
		});
	});
	it("rejects a missing council or published rank", async () => {
		await expect(
			read(indicators, lookup.replace("S12000018", "")),
		).rejects.toThrow(/no council area code for S01010891/);
		await expect(
			read(
				indicators,
				lookup
					.split("\n")
					.filter((line) => !line.startsWith("S01010891"))
					.join("\n"),
			),
		).rejects.toThrow(/no published rank for S01010891/);
	});
	it("reads all published ranks", async () => {
		const ranks = await publishedSIMDRanks(lookup);
		expect(ranks.get("S01010891")).toEqual({
			rank: 1,
			decile: 1,
			quintile: 1,
			councilAreaCode: "S12000018",
		});
		expect(ranks.size).toBe(2);
	});
});
