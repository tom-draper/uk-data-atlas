import { describe, expect, it } from "vitest";
import { summaryPositions } from "@/components/maps/RankingSummary";
import { matchingRows, sortedRows } from "@/components/maps/RankingTable";
import { findAtlasLocation, findAtlasMap } from "@/lib/atlas/pages";
import {
	barScale,
	type RankingContext,
	type RankingRow,
	rankingRow,
} from "@/lib/atlas/rankingRows";
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
			keys: [1],
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

	it("draws bars only for values from zero that spread out", () => {
		const area = (value: number) => ({ ...ward, value });
		expect(barScale([area(2), area(8)])).toBe(8);
		expect(barScale([area(76), area(85)])).toBeNull();
		expect(barScale([area(2), area(-1)])).toBeNull();
		expect(barScale([area(0)])).toBeNull();
		// One ward in ten far below the rest leaves the rest looking full.
		const even = [28, ...Array.from({ length: 9 }, (_, i) => 48 + i)];
		expect(barScale(even.map(area))).toBeNull();
		expect(barScale([10, 20, 30, 40, 50, 60].map(area))).toBe(60);
	});
});

describe("ranking table", () => {
	const row = (
		rank: number,
		name: string,
		keys: RankingRow["keys"],
		note?: string,
	): RankingRow => ({
		rank,
		code: name,
		name,
		note,
		value: "",
		extra: [],
		keys,
	});
	const rows = [
		row(1, "Hart", [85, null], "Hampshire"),
		row(2, "Richmond", [84.8, 3]),
		row(3, "Blackpool", [76.4, 1]),
	];
	const names = (list: readonly RankingRow[]) => list.map((r) => r.name);

	it("sorts by rank either way, and by a column with gaps last", () => {
		expect(
			names(sortedRows(rows, { column: "rank", descending: true })),
		).toEqual(["Blackpool", "Richmond", "Hart"]);
		expect(
			names(sortedRows(rows, { column: 1, descending: true })),
		).toEqual(["Richmond", "Blackpool", "Hart"]);
		expect(
			names(sortedRows(rows, { column: 1, descending: false })),
		).toEqual(["Blackpool", "Richmond", "Hart"]);
	});

	it("finds rows by name or council, every word", () => {
		expect(names(matchingRows(rows, "  "))).toEqual(names(rows));
		expect(names(matchingRows(rows, "hamp"))).toEqual(["Hart"]);
		expect(names(matchingRows(rows, "hart hamp"))).toEqual(["Hart"]);
		expect(matchingRows(rows, "hart kent")).toEqual([]);
	});
});
