import { describe, expect, it } from "vitest";
import { loadSIMD, publishedSIMDRanks } from "@/lib/data/simd/loader";

const lookupCsv = `DZ,DZname,SIMD2020v2_Rank,SIMD2020v2_Vigintile,SIMD2020v2_Decile,SIMD2020v2_Quintile
S01006506,Culter - 01,4691,14,7,4
S01010891,Greenock Town Centre and East Central - 01,1,1,1,1
`;

// The indicators file has no rank at all. Its rates must not be turned into
// one: the index is not a weighted sum of these columns.
const indicatorsCsv = `Data_Zone,Intermediate_Zone,Council_area,Income_rate,Employment_rate
S01006506,Culter,Aberdeen City,99%,99%
S01010891,Greenock Town Centre and East Central,Inverclyde,0%,0%
`;

describe("loadSIMD", () => {
	it("takes rank, decile and quintile from the published lookup", async () => {
		const datasets = await loadSIMD(async () => indicatorsCsv, lookupCsv);
		const data = datasets[2020].data;

		// Culter's extreme rates would put it first on any indicator-weighted
		// score; the published rank puts it in the least deprived half.
		expect(data.S01006506).toMatchObject({
			simdRank: 4691,
			simdDecile: 7,
			simdQuintile: 4,
			councilAreaCode: "S12000033",
		});
		expect(data.S01010891).toMatchObject({ simdRank: 1, simdDecile: 1 });
	});

	it("refuses a data zone the lookup does not rank", async () => {
		const missing = lookupCsv
			.split("\n")
			.filter((line) => !line.startsWith("S01010891"))
			.join("\n");
		await expect(
			loadSIMD(async () => indicatorsCsv, missing),
		).rejects.toThrow(/no published rank for S01010891/);
	});
});

describe("publishedSIMDRanks", () => {
	it("reads every ranked data zone", async () => {
		const ranks = await publishedSIMDRanks(lookupCsv);
		expect(ranks.get("S01010891")).toEqual({
			rank: 1,
			decile: 1,
			quintile: 1,
		});
		expect(ranks.size).toBe(2);
	});
});
