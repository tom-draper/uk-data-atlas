import { describe, expect, it } from "vitest";
import { summaryPositions } from "@/components/maps/RankingSummary";
import { findAtlasLocation, findAtlasMap } from "@/lib/atlas/pages";
import { type RankingContext, rankingRow } from "@/lib/atlas/rankingRows";
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
	const context = (
		level: MapRanking["level"],
		location = england,
		places: string[] = [],
	): RankingContext => ({
		location,
		map,
		ranking: { map: map.slug, level, areas: [] },
		places: new Set(places),
	});
	const ward = { code: "W1", name: "A ward", district: code, value: 1 };

	it("names a ward's council, except on that council's own page", () => {
		expect(rankingRow(context("ward"), ward, 2)).toMatchObject({
			rank: 3,
			note: council.name,
		});
		expect(
			rankingRow(context("ward", council), ward, 0).note,
		).toBeUndefined();
	});

	it("links an area to its place page, else a council to its maps", () => {
		expect(rankingRow(context("ward", england, ["W1"]), ward, 0).href).toBe(
			"/places/W1",
		);
		expect(rankingRow(context("ward"), ward, 0).href).toBeUndefined();
		expect(
			rankingRow(context("localAuthority"), { ...ward, code }, 0).href,
		).toBe(`/maps/${council.slug}`);
	});
});
