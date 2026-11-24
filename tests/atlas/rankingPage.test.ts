import { describe, expect, it } from "vitest";
import { summaryPositions } from "@/components/maps/RankingSummary";
import { findAtlasLocation, findAtlasMap } from "@/lib/atlas/pages";
import { rankingRow } from "@/lib/atlas/rankingRows";
import { COUNCIL_PLACES, type MapRanking } from "@/lib/atlas/rankings";

describe("ranking page summary", () => {
	it("leaves short rankings to their table", () => {
		expect(summaryPositions(11)).toBeNull();
	});

	it("picks the top five, bottom five and middle", () => {
		expect(summaryPositions(20)).toEqual({
			top: [0, 1, 2, 3, 4],
			bottom: [19, 18, 17, 16, 15],
			middle: 9,
		});
		expect(summaryPositions(21)?.middle).toBe(10);
	});
});

describe("ranking rows", () => {
	const [code, council] = [...COUNCIL_PLACES][0]!;
	const map = findAtlasMap("house-price")!;
	const england = findAtlasLocation("england")!;
	const ranking = (level: MapRanking["level"]): MapRanking => ({
		map: map.slug,
		level,
		areas: [],
	});
	const ward = { code: "W1", name: "A ward", district: code, value: 1 };

	it("names a ward's council, except on that council's own page", () => {
		expect(
			rankingRow(england, map, ranking("ward"), ward, 2),
		).toMatchObject({ rank: 3, note: council.name });
		expect(
			rankingRow(council, map, ranking("ward"), ward, 0).note,
		).toBeUndefined();
	});

	it("links councils to their maps and constituencies to their places", () => {
		const own = { ...ward, code };
		expect(
			rankingRow(england, map, ranking("localAuthority"), own, 0).href,
		).toBe(`/maps/${council.slug}`);
		expect(
			rankingRow(england, map, ranking("constituency"), ward, 0).href,
		).toBe("/places/W1");
	});
});
