import { calculateTurnout, getWinningParty, processPartyVotes } from "@/lib/helpers/generalElection";
import type { ConstituencyData } from "@/lib/types";
import type { PartyCode } from "@/lib/types";

// Minimal fixture — only fields used by the functions under test
const makeConstituency = (partyVotes: Record<string, number>): ConstituencyData =>
	({ partyVotes } as ConstituencyData);

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
		const data = makeConstituency({ CON: 1000, LAB: 5000, LD: 3000, GREEN: 500 });
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
		const result = processPartyVotes({ LAB: 500, CON: 300, LD: 200 }, partyInfo);
		expect(result.map((p) => p.key)).toEqual(["LAB", "CON", "LD"]);
	});
	it("calculates percentages correctly", () => {
		const result = processPartyVotes({ LAB: 500, CON: 300, LD: 200 }, partyInfo);
		expect(result[0].percentage).toBeCloseTo(50);
		expect(result[1].percentage).toBeCloseTo(30);
		expect(result[2].percentage).toBeCloseTo(20);
	});
	it("filters out parties with 0 votes", () => {
		const result = processPartyVotes({ LAB: 500, CON: 0, LD: 500 }, partyInfo);
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
