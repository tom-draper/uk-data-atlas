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

	it("puts adult social care clients against the council's adults", () => {
		expect(
			table(
				"adult-social-care-activity",
				{
					"2025": {
						year: 2025,
						data: {
							E06000001: {
								code: "E06000001",
								name: "Hartlepool",
								value: 18,
							},
						},
					},
				},
				{ "population-uk": populationUk("E06000001") },
			),
			// 720 residents are 18 to 89.
		).toEqual({
			columns: ["Per 1,000 adults"],
			rows: [["Hartlepool", "18", "25"]],
		});
	});

	it("adds decisions and applications per resident to planning", () => {
		expect(
			table(
				"planning-applications",
				{
					"2026": {
						year: 2026,
						data: {
							E06000001: {
								code: "E06000001",
								name: "Hartlepool",
								value: 45,
								metrics: { decided: 52, withdrawn: 3 },
							},
						},
					},
				},
				{ "population-uk": populationUk("E06000001") },
			),
			// 900 residents.
		).toEqual({
			columns: ["Decided", "Per 1,000 residents"],
			rows: [["Hartlepool", "45", "52", "50"]],
		});
	});

	it("adds the published change to workplace pay", () => {
		const { columns, rows } = table("workplace-income", {
			"2025": {
				year: 2025,
				data: {
					E06000001: {
						ladCode: "E06000001",
						ladName: "Hartlepool",
						annual: {
							median: 31_234.4,
							medianPercentageChange: 2.5,
						},
					},
				},
			},
		});
		expect(columns).toEqual(["Change since 2024"]);
		expect(rows).toEqual([["Hartlepool", "£31,234", "+2.5%"]]);
	});
});
