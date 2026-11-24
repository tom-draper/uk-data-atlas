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

	it("adds census neighbourhoods up into their councils", () => {
		const neighbourhood = (
			code: string,
			name: string,
			owned: number,
			social: number,
		) => ({
			code,
			name,
			metrics: { owned, social, private: 0, total: owned + social },
		});
		// England's neighbourhoods are filed by the deprivation file; Wales's
		// by name.
		const imd = {
			"2025": {
				year: 2025,
				data: {
					E01000001: { ladCode: "E06000001" },
					E01000002: { ladCode: "E06000001" },
				},
			},
		};
		expect(
			table(
				"housing-tenure",
				{
					"2021": {
						year: 2021,
						data: {
							E01000001: neighbourhood(
								"E01000001",
								"Hartlepool 001A",
								60,
								40,
							),
							E01000002: neighbourhood(
								"E01000002",
								"Hartlepool 001B",
								90,
								10,
							),
							W01000001: neighbourhood(
								"W01000001",
								"Cardiff 001A",
								58,
								42,
							),
						},
					},
				},
				{ imd },
			),
		).toEqual({
			columns: ["Social rent", "Private rent", "Households"],
			rows: [
				["Hartlepool", "75.0%", "25.0%", "0.0%", "200"],
				["Cardiff", "58.0%", "42.0%", "0.0%", "100"],
			],
		});
	});
});
