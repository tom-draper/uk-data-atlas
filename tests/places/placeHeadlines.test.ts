import { describe, expect, it } from "vitest";
import { rankOf, rankPhrase, scopeName } from "@/lib/places/headlines";

describe("rankPhrase", () => {
	it("names the ends of the ranking", () => {
		expect(rankPhrase(1, 361)).toBe("Highest");
		expect(rankPhrase(361, 361)).toBe("Lowest");
	});

	it("counts from the nearer end", () => {
		expect(rankPhrase(12, 361)).toBe("12th highest");
		expect(rankPhrase(359, 361)).toBe("3rd lowest");
		expect(rankPhrase(181, 361)).toBe("181st highest");
		expect(rankPhrase(182, 361)).toBe("180th lowest");
	});

	it("uses teen suffixes and the ranking's own words", () => {
		expect(rankPhrase(11, 650)).toBe("11th highest");
		expect(rankPhrase(112, 650)).toBe("112th highest");
		expect(
			rankPhrase(1, 650, ["largest majority", "smallest majority"]),
		).toBe("Largest majority");
		expect(
			rankPhrase(2, 650, ["largest majority", "smallest majority"]),
		).toBe("2nd largest majority");
	});
});

describe("rankOf", () => {
	it("ranks the highest first and shares ties", () => {
		expect(rankOf([5, 4, 4, 1], 5)).toBe(1);
		expect(rankOf([5, 4, 4, 1], 4)).toBe(2);
		expect(rankOf([5, 4, 4, 1], 1)).toBe(4);
	});
});

describe("scopeName", () => {
	it("names the nations the ranked codes belong to", () => {
		expect(scopeName(["E06000001", "E07000001"])).toBe("England");
		expect(scopeName(["E06000001", "W06000001"])).toBe("England and Wales");
		expect(scopeName(["E06000001", "W06000001", "S12000001"])).toBe(
			"Great Britain",
		);
		expect(
			scopeName(["E06000001", "W06000001", "S12000001", "N09000001"]),
		).toBe("the UK");
	});
});
