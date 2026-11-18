import { describe, expect, it } from "vitest";
import { findAtlasMap } from "@/lib/atlas/pages";
import { formatRankedValue, rankedValueLabel } from "@/lib/atlas/rankings";

const map = (slug: string) => findAtlasMap(slug)!;

describe("ranking tables read from dataset declarations", () => {
	it("writes values as each dataset declares", () => {
		const read = (slug: string, value: number) =>
			formatRankedValue(map(slug), value);
		expect(read("house-price", 3_750_000.4)).toBe("£3,750,000");
		expect(read("council-tax", 1234.5)).toBe("£1,234.50");
		expect(read("local-government-finance", 2_345.6)).toBe("£2,345,600");
		expect(read("regional-gdp", 12_345.6)).toBe("£12,346m");
		expect(read("ghg-emissions", 4.26)).toBe("4.3 tonnes");
		expect(read("fuel-poverty", 12.34)).toBe("12.3%");
		expect(read("travel-to-work", 7.06)).toBe("7.1%");
		expect(read("population-age", 40.26)).toBe("40.3 years");
		expect(read("population-density", 5_432.1)).toBe("5,432 per km²");
	});

	it("labels the value column from the declaration, else the map's name", () => {
		expect(rankedValueLabel(map("car-availability"))).toBe(
			"Households without a car",
		);
		expect(rankedValueLabel(map("population-density"))).toBe(
			"Residents per km²",
		);
		expect(rankedValueLabel(map("population-age"))).toBe("Median age");
		expect(rankedValueLabel(map("travel-to-work"))).toBe(
			map("travel-to-work").name,
		);
	});
});
