import { describe, expect, it } from "vitest";
import { GENERAL_ELECTION_SOURCES } from "@/lib/data/election/general-election/config";
import { parseGeneralElectionCsv } from "@/lib/data/election/general-election/load";

describe("2010 general-election source", () => {
	it("normalises the UCUNF column to the UUP party key", () => {
		const dataset = parseGeneralElectionCsv(
			[
				"ONS ID,Constituency name,Region name,Country name,First party,All other candidates,Majority,Electorate,Valid votes,Invalid votes,UUP (as UCUNF)",
				"N06000001,Example,North,United Kingdom,UUP,0,10,100,50,0,35",
			].join("\n"),
			GENERAL_ELECTION_SOURCES["general-election-2010"],
		);

		expect(dataset.boundaryYear).toBe(2010);
		expect(dataset.results.N06000001).toBe("UUP");
		expect(dataset.data.N06000001?.partyVotes).toEqual({ UUP: 35 });
	});
});
