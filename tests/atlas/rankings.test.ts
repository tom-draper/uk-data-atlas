import { describe, expect, it } from "vitest";
import { findAtlasLocation, findAtlasMap } from "@/lib/atlas/pages";
import { hasRankingFor, loadRanking } from "@/lib/atlas/rankingPages";
import {
	areasWithin,
	formatColumnValue,
	formatRankedValue,
	rankedAreaNoun,
} from "@/lib/atlas/rankings";
import {
	ageShare,
	medianAge,
	successorCouncil,
} from "@/lib/atlas/rankingRecipes";

const london = findAtlasLocation("london")!;

describe("ranking pages", () => {
	it("ranks a place's local authorities, highest first", async () => {
		const areas = areasWithin(await loadRanking("crime"), london);
		expect(areas).toHaveLength(33);
		expect(areas[0].name).toBe("Westminster");
		for (let index = 1; index < areas.length; index++)
			expect(areas[index - 1].value).toBeGreaterThanOrEqual(
				areas[index].value,
			);
	});

	it("ranks wards by their own names within a council", async () => {
		const leeds = findAtlasLocation("leeds")!;
		const areas = areasWithin(await loadRanking("house-price"), leeds);
		expect(areas.length).toBeGreaterThan(20);
		expect(new Set(areas.map((area) => area.district))).toEqual(
			new Set(leeds.members),
		);
	});

	it("has no page for a single council's local authority ranking", () => {
		expect(hasRankingFor("rutland", "crime")).toBe(false);
		expect(hasRankingFor("london", "crime")).toBe(true);
		expect(hasRankingFor("london", "general-election")).toBe(false);
	});

	it("reads values in full where the map's legend rounds them", () => {
		expect(formatRankedValue(findAtlasMap("house-price")!, 3_750_000)).toBe(
			"£3,750,000",
		);
		expect(formatRankedValue(findAtlasMap("crime")!, 74_649)).toBe(
			"74,649 offences",
		);
	});

	it("files a former council under the council that replaced it", () => {
		expect(successorCouncil("E07000026")).toBe("E06000063"); // Allerdale, Cumberland
		expect(successorCouncil("E07000027")).toBe("E06000064"); // Barrow, Westmorland and Furness
		expect(successorCouncil("E07000048")).toBe("E06000058"); // Christchurch, BCP
		expect(successorCouncil("E07000004")).toBe("E06000060"); // Aylesbury Vale, Buckinghamshire
		expect(successorCouncil("E07000165")).toBe("E06000065"); // Harrogate, North Yorkshire
		expect(successorCouncil("S12000015")).toBe("S12000047"); // Fife, recoded
		expect(successorCouncil("E08000035")).toBe("E08000035"); // Leeds, unchanged
	});

	it("counts a merged council once where a file holds its old councils too", async () => {
		const ranking = await loadRanking("claimant-count");
		const codes = ranking.areas.map((area) => area.code);
		expect(codes).toContain("E06000063");
		expect(codes).not.toContain("E07000026");
	});

	it("ranks 2016 councils under the places that hold them now", async () => {
		const areas = areasWithin(
			await loadRanking("brexit"),
			findAtlasLocation("buckinghamshire")!,
		);
		expect(areas.map((area) => area.name).sort()).toEqual([
			"Aylesbury Vale",
			"Chiltern",
			"South Bucks",
			"Wycombe",
		]);
		expect(hasRankingFor("buckinghamshire", "brexit")).toBe(true);
	});

	it("rolls neighbourhoods up into councils for deprivation", async () => {
		const ranking = await loadRanking("simd");
		expect(ranking.level).toBe("localAuthority");
		expect(rankedAreaNoun(findAtlasMap("simd")!)).toBe("local authority");
		// Every council, including one whose rows name it but leave out its code.
		expect(ranking.areas).toHaveLength(32);
		expect(ranking.areas.map((area) => area.name)).toContain(
			"Na h-Eileanan Siar",
		);
		for (const area of ranking.areas) {
			expect(area.value).toBeGreaterThanOrEqual(0);
			expect(area.value).toBeLessThanOrEqual(area.extra![0]!);
		}
	});

	it("adds a change on the previous edition where the file holds one", async () => {
		const ranking = await loadRanking("child-poverty");
		expect(ranking.columns?.[0]).toEqual({
			label: "Change since 2024",
			format: "signedPoints",
		});
		expect(formatColumnValue(ranking.columns![0]!, 1.23)).toBe("+1.2 pts");
		expect(formatColumnValue(ranking.columns![0]!, -0.04)).toBe("0.0 pts");
		expect(formatColumnValue(ranking.columns![0]!, null)).toBe("–");
	});

	it("works out a median age within the year of age", () => {
		expect(medianAge({ 0: 10, 1: 10 })).toBe(1);
		expect(medianAge({ 30: 0, 40: 4, 41: 4 })).toBe(41);
		expect(medianAge({ 20: 1, 21: 2, 22: 1 })).toBeCloseTo(21.5);
		expect(ageShare({ 10: 1, 70: 3 }, 65)).toBe(75);
	});
});
