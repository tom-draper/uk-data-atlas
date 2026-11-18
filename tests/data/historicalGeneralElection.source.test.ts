import { describe, expect, it } from "vitest";
import { historicalGeneralElectionParts } from "@uk-data-atlas/datasets";

const HEADER =
	"constituency_id,seats,constituency_name,country/region,electorate,con_votes,con_share,lib_votes ,lib_share,lab_votes,lab_share,natSW_votes,natSW_share,oth_votes,oth_share,total_votes,turnout ,election,boundary_set,";

const valuesOf = (record: { values: { measure: string }[] } | undefined) =>
	record?.values ?? [];

describe("historicalGeneralElectionParts", () => {
	it("groups rows by election and scales shares to a percentage", () => {
		const parts = historicalGeneralElectionParts(
			[
				HEADER,
				"100,1,Example,South East,1000,600,0.6,,,400,0.4,,,,,1000,0.8,2005,2005,",
			].join("\n"),
		);

		expect(parts.map((part) => part.key)).toEqual(["2005"]);
		const [record] = parts[0]!.records;
		expect(record).toMatchObject({
			code: "100",
			contest: { area_name: "Example", region: "South East" },
		});
		expect(valuesOf(record)).toEqual([
			{ measure: "seats", value: 1 },
			{ measure: "electorate", value: 1000 },
			{
				measure: "party-votes",
				members: { "party-group": "CON" },
				value: 600,
			},
			{
				measure: "party-vote-share",
				members: { "party-group": "CON" },
				value: 60,
			},
			{
				measure: "party-votes",
				members: { "party-group": "LAB" },
				value: 400,
			},
			{
				measure: "party-vote-share",
				members: { "party-group": "LAB" },
				value: 40,
			},
			{ measure: "valid-votes", value: 1000 },
			{ measure: "turnout", value: 80 },
		]);
	});

	it("keeps February and October 1974 as separate elections", () => {
		const parts = historicalGeneralElectionParts(
			[
				HEADER,
				"1,1,Example,North,,,,,,,,,,,,,,1974F,1974-1979,",
				"1,1,Example,North,,,,,,,,,,,,,,1974O,1974-1979,",
			].join("\n"),
		);

		expect(parts.map((part) => part.key).sort()).toEqual([
			"1974F",
			"1974O",
		]);
	});

	it("falls back to the constituency name when constituency_id is blank", () => {
		const [part] = historicalGeneralElectionParts(
			[
				HEADER,
				",1, Belfast Victoria,Ireland,,,,,,,,,,13317,1,13317,0.683,1918,1918-1935,",
			].join("\n"),
		);

		expect(part?.records[0]).toMatchObject({
			code: "belfast victoria",
			contest: { area_name: "Belfast Victoria" },
		});
	});

	it("treats a -1 sentinel as missing data rather than a negative count", () => {
		const [part] = historicalGeneralElectionParts(
			[
				HEADER,
				"2,1,Carlow,Ireland,,,,,,,,,,-1,1,-1,,1918,1918-1935,",
			].join("\n"),
		);

		const values = valuesOf(part?.records[0]);
		expect(values).toContainEqual({ measure: "valid-votes", value: null });
		expect(
			values.some(
				(value) =>
					value.measure === "party-votes" &&
					"members" in value &&
					(value.members as { "party-group"?: string })[
						"party-group"
					] === "OTHER",
			),
		).toBe(false);
	});
});
