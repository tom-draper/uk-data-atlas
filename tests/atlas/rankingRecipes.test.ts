import { describe, expect, it } from "vitest";
import { findAtlasMap } from "@/lib/atlas/pages";
import {
	compileRanking,
	formatColumnValue,
	formatRankedValue,
	rankingSource,
} from "@/lib/atlas/rankings";
import type { Editions } from "@/lib/atlas/rankingRecipes";

/** Counts by single year of age: `count` people at each age in `ages`. */
const ages = (count: number, from: number, to: number) =>
	Object.fromEntries(
		Array.from({ length: to - from + 1 }, (_, index) => [
			String(from + index),
			count,
		]),
	);

/** A population file of each council's residents: 10 at each age 0 to 89. */
const populationUk = (...codes: string[]): Editions => ({
	"2025": {
		year: 2025,
		data: Object.fromEntries(
			codes.map((code) => [code, { total: ages(10, 0, 89) }]),
		),
	},
});

/** A ranking's rows as its table writes them. */
function table(slug: string, editions: Editions, inputs = {}) {
	const map = findAtlasMap(slug)!;
	const ranking = compileRanking(map, editions, inputs)!;
	return {
		columns: ranking.columns?.map((column) => column.label),
		rows: ranking.areas.map((area) => [
			area.name,
			formatRankedValue(map, area.value),
			...(ranking.columns ?? []).map((column, index) =>
				formatColumnValue(column, area.extra?.[index]),
			),
		]),
	};
}

describe("ranking recipes", () => {
	it("ranks wards by women's share of their residents", () => {
		expect(rankingSource(findAtlasMap("population-gender")!)?.level).toBe(
			"ward",
		);
		const ward = (name: string, women: number, men: number) => ({
			wardName: name,
			ladCode: "E06000001",
			females: { "20": women },
			males: { "20": men },
		});
		expect(
			table("population-gender", {
				"2022": {
					year: 2022,
					data: {
						E05000001: ward("Barracks", 300, 700),
						E05000002: ward("Seafront", 560, 440),
					},
				},
			}),
		).toEqual({
			columns: ["Women", "Men"],
			rows: [
				["Seafront", "56.0%", "560", "440"],
				["Barracks", "30.0%", "300", "700"],
			],
		});
	});
});
