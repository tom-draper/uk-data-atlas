import { describe, expect, it } from "vitest";
import { ordinal, placeRankings, standing } from "@/lib/places/rankings";

describe("place rankings", () => {
	it("ranks a council among its region's", async () => {
		const rankings = await placeRankings("E08000035", "localAuthority");
		const crime = rankings.find((ranking) => ranking.map.slug === "crime");
		expect(crime?.group.slug).toBe("yorkshire");
		expect(crime!.rank).toBeGreaterThanOrEqual(1);
		expect(crime!.rank).toBeLessThanOrEqual(crime!.of);
	});

	it("ranks a council outside England among its nation's", async () => {
		const rankings = await placeRankings("W06000015", "localAuthority");
		expect(rankings.length).toBeGreaterThan(0);
		expect(
			rankings.every((ranking) => ranking.group.slug === "wales"),
		).toBe(true);
	});

	it("ranks a ward among its council's", async () => {
		const rankings = await placeRankings("E05011289", "ward");
		expect(rankings.map((ranking) => ranking.map.slug).sort()).toEqual([
			"house-price",
			"population-age",
			"population-density",
		]);
		expect(rankings[0]!.group.kind).toBe("local-authority");
	});

	it("ranks a constituency among its region's", async () => {
		const [election] = await placeRankings("E14001331", "constituency");
		expect(election?.map.slug).toBe("general-election");
		expect(election?.group.slug).toBe("london");
	});

	it("reads a rank from its nearer end", () => {
		expect(standing(1, 13)).toBe("Highest");
		expect(standing(2, 13)).toBe("2nd highest");
		expect(standing(7, 13)).toBe("7th highest");
		expect(standing(8, 13)).toBe("6th lowest");
		expect(standing(12, 13)).toBe("2nd lowest");
		expect(standing(13, 13)).toBe("Lowest");
		expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 111].map(ordinal)).toEqual([
			"1st",
			"2nd",
			"3rd",
			"4th",
			"11th",
			"12th",
			"13th",
			"21st",
			"22nd",
			"111th",
		]);
	});
});
