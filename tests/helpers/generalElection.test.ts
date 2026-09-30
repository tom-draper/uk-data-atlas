import {
	calculateTurnout,
	computeGeneralElectionYearData,
	getWinningParty,
	processPartyVotes,
} from "@/lib/helpers/generalElection";
import type {
	GeneralElectionConstituencyData,
	GeneralElectionDataset,
	SelectedArea,
} from "@/lib/types";
import type { PartyCode } from "@/lib/types";

// Minimal fixture — only fields used by the functions under test
const makeConstituency = (
	partyVotes: Record<string, number>,
): GeneralElectionConstituencyData =>
	({ partyVotes }) as GeneralElectionConstituencyData;

describe("calculateTurnout", () => {
	it("calculates turnout as a percentage", () => {
		// 750 total votes cast out of 1000 electorate = 75%
		expect(calculateTurnout(700, 50, 1000)).toBeCloseTo(75);
	});
	it("returns null when electorate is 0", () => {
		expect(calculateTurnout(500, 0, 0)).toBeNull();
	});
	it("returns null when electorate is missing", () => {
		expect(calculateTurnout(500, 0, undefined as any)).toBeNull();
	});
	it("includes invalid votes in the total", () => {
		// 800 valid + 200 invalid = 1000 out of 2000 = 50%
		expect(calculateTurnout(800, 200, 2000)).toBeCloseTo(50);
	});
});

describe("getWinningParty", () => {
	it("returns the party with the most votes", () => {
		const data = makeConstituency({ LAB: 15000, CON: 10000, LD: 5000 });
		expect(getWinningParty(data)).toBe("LAB");
	});
	it("returns the correct winner when trailing parties have more entries", () => {
		const data = makeConstituency({
			CON: 1000,
			LAB: 5000,
			LD: 3000,
			GREEN: 500,
		});
		expect(getWinningParty(data)).toBe("LAB");
	});
	it("returns empty string for empty partyVotes", () => {
		const data = makeConstituency({});
		expect(getWinningParty(data)).toBe("");
	});
	it("ignores undefined vote counts", () => {
		const data = makeConstituency({ LAB: 10000, CON: undefined as any });
		expect(getWinningParty(data)).toBe("LAB");
	});
});

describe("processPartyVotes", () => {
	const partyInfo = [
		{ key: "LAB" as PartyCode, name: "Labour" },
		{ key: "CON" as PartyCode, name: "Conservative" },
		{ key: "LD" as PartyCode, name: "Lib Dems" },
	];

	it("returns results sorted by votes descending", () => {
		const result = processPartyVotes(
			{ LAB: 500, CON: 300, LD: 200 },
			partyInfo,
		);
		expect(result.map((p) => p.key)).toEqual(["LAB", "CON", "LD"]);
	});
	it("calculates percentages correctly", () => {
		const result = processPartyVotes(
			{ LAB: 500, CON: 300, LD: 200 },
			partyInfo,
		);
		expect(result[0].percentage).toBeCloseTo(50);
		expect(result[1].percentage).toBeCloseTo(30);
		expect(result[2].percentage).toBeCloseTo(20);
	});
	it("filters out parties with 0 votes", () => {
		const result = processPartyVotes(
			{ LAB: 500, CON: 0, LD: 500 },
			partyInfo,
		);
		expect(result.find((p) => p.key === "CON")).toBeUndefined();
	});
	it("returns empty array when total votes is 0", () => {
		expect(processPartyVotes({ LAB: 0, CON: 0 }, partyInfo)).toEqual([]);
	});
	it("returns empty array for empty partyVotes", () => {
		expect(processPartyVotes({}, partyInfo)).toEqual([]);
	});
	it("includes votes and name in each result", () => {
		const result = processPartyVotes({ LAB: 1000 }, partyInfo);
		expect(result[0].votes).toBe(1000);
		expect(result[0].name).toBe("Labour");
	});
});

describe("computeGeneralElectionYearData", () => {
	it("shows the best-fit constituency result for a hovered ward", () => {
		const dataset: GeneralElectionDataset = {
			id: "general-election-2024",
			type: "generalElection",
			year: 2024,
			boundaryType: "constituency",
			boundaryYear: 2024,
			partyInfo: [
				{ key: "LAB", name: "Labour" },
				{ key: "CON", name: "Conservative" },
			],
			data: {
				C1: {
					constituencyName: "Example constituency",
					onsId: "C1",
					regionName: "Example region",
					countryName: "England",
					constituencyType: "Borough",
					memberFirstName: "Example",
					memberSurname: "Member",
					memberGender: "F",
					result: "LAB",
					firstParty: "LAB",
					secondParty: "CON",
					electorate: 1_000,
					validVotes: 700,
					invalidVotes: 10,
					majority: 100,
					partyVotes: { LAB: 400, CON: 300 },
					turnoutPercent: 71,
				},
			},
			results: { C1: "LAB" },
		};
		const ward: SelectedArea = {
			type: "ward",
			code: "W1",
			name: "Example ward",
			data: null,
		};

		const result = computeGeneralElectionYearData(
			2024,
			dataset,
			null,
			ward,
			{ getConstituencyForWard: () => "C1" },
			undefined,
			undefined,
		);

		expect(result).toMatchObject({
			hasData: true,
			viaConstituency: true,
			partyData: [
				{ key: "LAB", votes: 400 },
				{ key: "CON", votes: 300 },
			],
		});
	});
});
