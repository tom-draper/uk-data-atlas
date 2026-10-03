import { describe, expect, it } from "vitest";
import { findAtlasLocation, findAtlasMap } from "@/lib/atlas/pages";
import { hasRankingFor, loadRanking } from "@/lib/atlas/rankingPages";
import { areasWithin, formatRankedValue } from "@/lib/atlas/rankings";

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
});
