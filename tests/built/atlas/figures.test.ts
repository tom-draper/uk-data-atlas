import { describe, expect, it } from "vitest";
import figures from "@/public/data/datasets/map-figures.json";
import { type MapFigures, mapFigureSentence } from "@/lib/atlas/figures";
import { findAtlasLocation, findAtlasMap } from "@/lib/atlas/pages";
import { atlasMapSnippet } from "@/lib/atlas/snippets";

const committed = figures as unknown as MapFigures;
const sentence = (location: string, map: string) =>
	mapFigureSentence(committed, findAtlasLocation(location)!, map);

describe("map page figures", () => {
	it("describes a place from totals, ranges or its own published value", () => {
		expect(sentence("london", "population-density")).toMatch(
			/^London has 8\.\d million people, about 5,\d{3} per km²\.$/,
		);
		expect(sentence("london", "house-price")).toMatch(
			/^Median house prices in London range from £[\d,]+ in .+, .+ to £[\d.]+ million in .+, .+ \(2023\)\.$/,
		);
		expect(sentence("leeds", "life-expectancy")).toMatch(
			/^Life expectancy at birth in Leeds is \d+\.\d years for men and \d+\.\d for women/,
		);
		expect(sentence("london", "income")).toMatch(
			/^Median annual pay for employees living in London is £[\d,]+ \(2025\)\.$/,
		);
	});

	it("builds rates for a whole place from its totals", () => {
		expect(sentence("london", "child-poverty")).toMatch(
			/^\d+\.\d% of children in London live in relative low-income families/,
		);
		expect(sentence("london", "broadband")).toMatch(
			/^\d+\.\d% of premises in London can get full fibre broadband \(2025\)\.$/,
		);
		expect(sentence("london", "homelessness")).toMatch(
			/^London had [\d,]+ households in temporary accommodation in .+, \d+\.\d per 1,000 households\.$/,
		);
		expect(sentence("united-kingdom", "ghg-emissions")).toMatch(
			/^The United Kingdom emitted [\d.]+ million tonnes CO2e of greenhouse gases in 2024, \d\.\d tonnes per person\.$/,
		);
	});

	it("counts each business once", () => {
		// ONS counts about 2.7 million VAT or PAYE businesses in the UK. The
		// table's own Total column, added to its industries, once doubled it.
		const uk = committed["business-activity"]["united-kingdom"];
		expect(uk.kind === "count" && uk.count).toBeGreaterThan(2_500_000);
		expect(uk.kind === "count" && uk.count).toBeLessThan(3_000_000);
	});

	it("gives no figure for data that does not reach the whole place", () => {
		// Crime covers England and Wales, so a UK total would leave out two nations.
		expect(sentence("united-kingdom", "crime")).toBeNull();
		expect(sentence("london", "ethnicity")).toBeNull();
	});

	it("leads the search snippet with the figure", () => {
		const snippet = atlasMapSnippet(
			findAtlasLocation("london")!,
			findAtlasMap("population-density")!,
		);
		expect(snippet.startsWith("London has ")).toBe(true);
		expect(snippet).toContain("interactive ward map");
	});
});
