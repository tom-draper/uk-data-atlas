import { describe, expect, it } from "vitest";
import { ATLAS_LOCATIONS, findAtlasMap } from "@/lib/atlas/pages";
import {
	areasWithin,
	compileRanking,
	formatColumnValue,
	findRanking,
	formatRankedValue,
	hasRankingPage,
	rankingKey,
	rankingSource,
	rankingTitle,
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
	const map = findRanking(slug)!.map;
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

	it("ranks county and unitary councils, counties by their districts", () => {
		const map = findAtlasMap("pupil-absence")!;
		const council = (name: string, missed: number, persistent: number) => ({
			name,
			metrics: {
				sessions: 1000,
				overall: missed,
				unauthorised: missed / 4,
				enrolments: 100,
				persistent,
			},
			value: missed / 10,
		});
		const editions: Editions = {
			"2025": {
				year: 2025,
				data: {
					E10000016: council("Kent", 60, 18),
					E06000035: council("Medway", 75, 22),
					E06000001: council("Hartlepool", 70, 20),
				},
			},
		};
		const ranking = compileRanking(map, editions)!;
		expect(ranking.level).toBe("countyAndUnitaryAuthority");
		expect(
			ranking.areas.find((area) => area.code === "E10000016"),
		).toMatchObject({
			district: "E07000105",
			within: expect.arrayContaining(["E07000116"]),
		});
		const kent = ATLAS_LOCATIONS.find(
			(location) => location.slug === "kent",
		)!;
		expect(areasWithin(ranking, kent).map((area) => area.name)).toEqual([
			"Medway",
			"Kent",
		]);
		expect(table("pupil-absence", editions)).toEqual({
			columns: ["Persistently absent", "Unauthorised absence"],
			rows: [
				["Medway", "7.5%", "22.0%", "1.9%"],
				["Hartlepool", "7.0%", "20.0%", "1.8%"],
				["Kent", "6.0%", "18.0%", "1.5%"],
			],
		});
	});

	it("ranks each council's wards from its latest election", () => {
		const ward = (
			name: string,
			ladCode: string,
			partyVotes: Record<string, number>,
			turnoutPercent?: number,
		) => ({ wardName: name, ladCode, partyVotes, turnoutPercent });
		const editions: Editions = {
			"2019": {
				year: 2019,
				data: {
					// Too long before the latest election to fill a gap.
					E05011390: ward("Old Cycle", "E08000003", {
						LAB: 900,
						CON: 100,
					}),
				},
			},
			"2022": {
				year: 2022,
				data: {
					// A code below the latest election's: a ward since redrawn.
					E05000100: ward("Redrawn", "E08000003", {
						LAB: 500,
						CON: 100,
					}),
				},
			},
			"2023": {
				year: 2023,
				data: {
					// No council in the source, so the ward lookup's.
					E05011400: ward(
						"Not Up In 2024",
						"Unknown",
						{ LD: 450, LAB: 50 },
						30,
					),
					E05011366: ward("Harpurhey", "E08000003", {
						LAB: 900,
						CON: 100,
					}),
					// A council since merged away.
					E05009000: ward("Abolished", "E07000004", {
						CON: 900,
						LAB: 100,
					}),
				},
			},
			"2024": {
				year: 2024,
				data: {
					E05011359: ward(
						"Clayton",
						"E08000003",
						{ LAB: 1000, CON: 400 },
						25,
					),
					E05011366: ward("Harpurhey", "E08000003", {
						CON: 300,
						LAB: 200,
					}),
					E05011370: ward("Uncontested", "E08000003", { LAB: 800 }),
				},
			},
			"2025": {
				year: 2025,
				data: {
					// A county division, another tier of council.
					E58000050: ward("Abbey", "Unknown", {
						GREEN: 900,
						LAB: 100,
					}),
				},
			},
		};
		expect(
			table("local-election", editions, {
				"ward-lad": { E05011400: "E08000003" },
			}),
		).toEqual({
			columns: ["Winner", "Majority", "Turnout", "Election"],
			rows: [
				[
					"Not Up In 2024",
					"80.0%",
					"Liberal Democrat",
					"400",
					"30.0%",
					"2023",
				],
				["Clayton", "42.9%", "Labour", "600", "25.0%", "2024"],
				["Harpurhey", "20.0%", "Conservative", "100", "–", "2024"],
			],
		});
	});

	it("ranks each county's divisions from its latest election", () => {
		const division = (
			name: string,
			ladCode: string,
			partyVotes: Record<string, number>,
			ladName = "",
		) => ({ wardName: name, ladCode, ladName, partyVotes });
		const editions: Editions = {
			"2017": {
				year: 2017,
				data: {
					// Only its county, so no district to place it in.
					E58000001: division("County Only", "E10000003", {
						CON: 900,
						LAB: 100,
					}),
				},
			},
			"2021": {
				year: 2021,
				data: {
					// Cambridgeshire's earlier election, since superseded.
					E58000002: division("Superseded", "E07000008", {
						CON: 600,
						LAB: 400,
					}),
					E58000400: division("Basildon Central", "E07000066", {
						CON: 700,
						LAB: 300,
					}),
					E58000401: division("Basildon East", "E07000066", {
						LAB: 550,
						CON: 450,
					}),
				},
			},
			"2023": {
				year: 2023,
				data: {
					// A by-election, not Essex's latest election.
					E58000401: division("Basildon East", "E07000066", {
						REF: 800,
						LAB: 200,
					}),
				},
			},
			"2025": {
				year: 2025,
				data: {
					// By district name, the code left out.
					E58000050: division(
						"Abbey",
						"Unknown",
						{ GREEN: 900, LAB: 100 },
						"Cambridge",
					),
					E58000051: division(
						"Arbury",
						"Unknown",
						{ LAB: 600, LD: 400 },
						"Cambridge",
					),
					// "&" for "and" in the district's name.
					E58000700: division(
						"Hythe",
						"Unknown",
						{ REF: 650, CON: 350 },
						"Folkestone & Hythe",
					),
					// A district council's ward, ranked with its own.
					E05011359: division("Clayton", "E08000003", {
						LAB: 1000,
						CON: 400,
					}),
				},
			},
		};
		const ranking = compileRanking(
			findRanking("county-election")!.map,
			editions,
		)!;
		expect(ranking.level).toBe("division");
		expect(ranking.areas.map((area) => [area.name, area.district])).toEqual(
			[
				["Abbey", "E07000008"],
				["Basildon Central", "E07000066"],
				["Hythe", "E07000112"],
				["Arbury", "E07000008"],
				["Basildon East", "E07000066"],
			],
		);
		expect(table("county-election", editions).rows[0]).toEqual([
			"Abbey",
			"80.0%",
			"Green",
			"800",
			"–",
			"2025",
		]);
		expect(rankingTitle(findRanking("county-election")!.map)).toBe(
			"Latest County Council Election Results",
		);
	});

	it("ranks earlier general elections for the UK and its nations", () => {
		const map = findAtlasMap("general-election")!;
		const seat = (name: string, majority: number) => ({
			constituencyName: name,
			majority,
			validVotes: 1000,
			firstParty: "Con",
		});
		const editions: Editions = {
			"2019": {
				id: "general-election-2019",
				year: 2019,
				data: {
					E14000530: seat("Old Seat", 300),
					E14000531: seat("Other Old Seat", 100),
				},
			},
			"2024": {
				id: "general-election-2024",
				year: 2024,
				data: { E14001063: seat("New Seat", 50) },
			},
		};
		const overlaps = {
			releases: {
				"2024-07-uk-bgc": {
					E14000530: [{ code: "E08000003", weight: 1 }],
					E14000531: [{ code: "E08000003", weight: 1 }],
					E14001063: [{ code: "E08000003", weight: 1 }],
				},
			},
		};
		const inputs = { "constituency-lad-overlaps": overlaps };
		const ranking = compileRanking(map, editions, inputs, 2019)!;
		expect(ranking.period).toBe(2019);
		expect(ranking.areas.map((area) => area.name)).toEqual([
			"Old Seat",
			"Other Old Seat",
		]);
		expect(compileRanking(map, editions, inputs)!.period).toBeUndefined();

		const place = (slug: string) =>
			ATLAS_LOCATIONS.find((location) => location.slug === slug)!;
		expect(hasRankingPage(ranking, map, place("england"))).toBe(true);
		expect(hasRankingPage(ranking, map, place("manchester"))).toBe(false);

		expect(rankingKey(map, 2019)).toBe("general-election-2019");
		expect(rankingKey(map, map.periods[0])).toBe("general-election");
		expect(findRanking("general-election-2019")).toEqual({
			map,
			period: 2019,
		});
		expect(findRanking("general-election-2024")).toBeNull();
		expect(findRanking("general-election-1997")).toBeNull();
		expect(findRanking("local-election-2019")).toBeNull();
		expect(rankingTitle(map, 2019)).toBe("2019 General Election Results");
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
