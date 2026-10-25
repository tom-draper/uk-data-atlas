import { describe, expect, it } from "vitest";
import { earlierWinners } from "@/components/places/PlaceElections";
import {
	compilePlaceElections,
	type SourceEdition,
} from "@/lib/places/elections";

const editions: SourceEdition[] = [
	{
		year: 2022,
		data: {
			W1: { ladCode: "E07000001", partyVotes: { LAB: 900, CON: 1000 } },
			W2: { ladCode: "E07000001", partyVotes: { LAB: 700, CON: 300 } },
		},
	},
	{
		year: 2024,
		results: { W1: "LAB" },
		data: {
			// The source gives no council this year; the lookup does.
			W1: {
				ladCode: "Unknown",
				turnoutPercent: 31.24,
				partyVotes: { CON: 500, LAB: 600, GREEN: 0 },
			},
		},
	},
];

describe("compilePlaceElections", () => {
	const compiled = compilePlaceElections(editions, { W1: "E06000099" });

	it("keeps each ward's latest result and its earlier winners", () => {
		expect(compiled.wards.W1).toEqual({
			latest: {
				year: 2024,
				winner: "LAB",
				turnout: 31.2,
				votes: [
					["LAB", 600],
					["CON", 500],
				],
			},
			earlier: [[2022, "CON"]],
		});
		expect(compiled.wards.W2?.latest.turnout).toBeUndefined();
	});

	it("sums each council's wards, preferring the source's council", () => {
		expect(compiled.councils.E07000001).toEqual([
			{
				year: 2022,
				wards: 2,
				won: [
					["CON", 1],
					["LAB", 1],
				],
				share: [
					["LAB", 55.2],
					["CON", 44.8],
				],
			},
		]);
		expect(compiled.councils.E06000099?.[0]?.year).toBe(2024);
	});
});

describe("earlierWinners", () => {
	it("joins a party's run of wins into one span", () => {
		expect(
			earlierWinners([
				[2023, "CON"],
				[2022, "CON"],
				[2019, "CON"],
			]),
		).toBe(
			"Conservative also won every earlier election in the data (2019 to 2023).",
		);
		expect(
			earlierWinners([
				[2023, "LAB"],
				[2022, "CON"],
				[2021, "CON"],
			]),
		).toBe("Earlier winners: Labour (2023), Conservative (2021 to 2022).");
	});
});
