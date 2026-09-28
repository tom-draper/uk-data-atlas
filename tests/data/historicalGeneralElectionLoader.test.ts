import { describe, expect, it } from "vitest";
import { parseHistoricalGeneralElectionCsv } from "@/lib/data/historical-general-election/loader";

const HEADER =
	"constituency_id,seats,constituency_name,country/region,electorate,con_votes,con_share,lib_votes ,lib_share,lab_votes,lab_share,natSW_votes,natSW_share,oth_votes,oth_share,total_votes,turnout ,election,boundary_set,";

describe("parseHistoricalGeneralElectionCsv", () => {
	it("groups rows by election and scales shares to a percentage", () => {
		const csv = [
			HEADER,
			"100,1,Example,South East,1000,600,0.6,,,400,0.4,,,,,1000,0.8,2005,2005,",
		].join("\n");

		const datasets = parseHistoricalGeneralElectionCsv(csv);

		expect(Object.keys(datasets)).toEqual(["2005"]);
		const dataset = datasets["2005"];
		expect(dataset.year).toBe(2005);
		expect(dataset.boundarySet).toBe("2005");
		expect(dataset.data["100"]).toEqual({
			constituencyId: "100",
			constituencyName: "Example",
			region: "South East",
			seats: 1,
			electorate: 1000,
			votes: { CON: 600, LAB: 400 },
			voteShare: { CON: 60, LAB: 40 },
			totalVotes: 1000,
			turnoutPercent: 80,
		});
	});

	it("keeps February and October 1974 as separate elections in the same year", () => {
		const csv = [
			HEADER,
			"1,1,Example,North,,,,,,,,,,,,,,1974F,1974-1979,",
			"1,1,Example,North,,,,,,,,,,,,,,1974O,1974-1979,",
		].join("\n");

		const datasets = parseHistoricalGeneralElectionCsv(csv);

		expect(Object.keys(datasets).sort()).toEqual(["1974F", "1974O"]);
		expect(datasets["1974F"].year).toBe(1974);
		expect(datasets["1974O"].year).toBe(1974);
	});

	it("falls back to the constituency name when constituency_id is blank", () => {
		const csv = [
			HEADER,
			",1, Belfast Victoria,Ireland,,,,,,,,,,13317,1,13317,0.683,1918,1918-1935,",
		].join("\n");

		const datasets = parseHistoricalGeneralElectionCsv(csv);

		expect(datasets["1918"].data["belfast victoria"]).toMatchObject({
			constituencyId: "belfast victoria",
			constituencyName: "Belfast Victoria",
		});
	});

	it("treats a -1 sentinel as missing data rather than a negative count", () => {
		const csv = [
			HEADER,
			"2,1,Carlow,Ireland,,,,,,,,,,-1,1,-1,,1918,1918-1935,",
		].join("\n");

		const datasets = parseHistoricalGeneralElectionCsv(csv);

		const result = datasets["1918"].data["2"];
		expect(result.totalVotes).toBeNull();
		expect(result.votes.OTHER).toBeUndefined();
	});
});
