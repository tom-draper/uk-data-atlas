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
