import { describe, expect, it } from "vitest";
import {
	GENERAL_ELECTION_SOURCES,
	generalElectionRecords,
} from "@uk-data-atlas/datasets";

describe("2010 general-election source", () => {
	it("normalises the UCUNF column to the UUP party key", () => {
		const [record] = generalElectionRecords(
			[
				"ONS ID,Constituency name,Region name,Country name,First party,All other candidates,Majority,Electorate,Valid votes,Invalid votes,UUP (as UCUNF)",
				"N06000001,Example,North,United Kingdom,UUP,0,10,100,50,0,35",
			].join("\n"),
			GENERAL_ELECTION_SOURCES["general-election-2010"],
		);

		expect(record?.code).toBe("N06000001");
		expect(record?.contest?.winner).toBe("UUP");
		expect(
			record?.values
				.filter(({ measure }) => measure === "party-votes")
				.map(({ members, value }) => [members, value]),
		).toEqual([[{ party: "UUP" }, 35]]);
	});
});
