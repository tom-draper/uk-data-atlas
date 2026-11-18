import { describe, expect, it } from "vitest";
import { brexitStatisticsParts } from "@uk-data-atlas/datasets";
import type { DatasetReader } from "@uk-data-atlas/datasets";

const row = (code: string, region = "North East") => ({
	Area_Code: code,
	Area: `Area ${code}`,
	Region_Code: "E12000001",
	Region: region,
	Electorate: "1,000",
	Valid_Votes: "700",
	Remain: "300",
	Leave: "400",
	Rejected_Ballots: "2",
	Pct_Remain: "42.86",
	Pct_Leave: "57.14",
	Pct_Turnout: "70.2",
});

const reader =
	(rows: Array<Record<string, string>>): DatasetReader["csvRows"] =>
	async (_path, _options, visit) => {
		rows.forEach((entry) => visit(entry));
	};

describe("brexitStatisticsParts", () => {
	it("reads one 2016 part with each area's votes and its region", async () => {
		const [part, ...rest] = await brexitStatisticsParts(
			reader([row("E06000047")]),
		);
		expect(rest).toEqual([]);
		expect(part!.key).toBe("2016");
		const [area] = part!.records;
		expect(area).toMatchObject({
			code: "E06000047",
			name: "Area E06000047",
			parents: {
				regionCode: { code: "E12000001", name: "North East" },
			},
		});
		expect(area!.values).toContainEqual({
			measure: "referendum-votes",
			members: { "referendum-answer": "leave" },
			value: 400,
		});
		expect(area!.values).toContainEqual({
			measure: "referendum-vote-share",
			members: { "referendum-answer": "remain" },
			value: 42.86,
		});
		expect(area!.values).toContainEqual({
			measure: "electorate",
			value: 1000,
		});
	});

	it("leaves out Gibraltar and rows with no area code", async () => {
		const [part] = await brexitStatisticsParts(
			reader([row("GI"), row(""), row("W06000001")]),
		);
		expect(part!.records.map((record) => record.code)).toEqual([
			"W06000001",
		]);
	});
});
