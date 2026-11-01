import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convertChoices, convertedTable, countInput } from "@/lib/fix/convert";
import { diagnose } from "@/lib/fix/diagnose";
import { readTable } from "@/lib/fix/table";
import type { ConvertedCounts, Crosswalk } from "@/lib/fix/types";
import { fixture, releases, sampleInput } from "./sample";

const crosswalks = fixture<Crosswalk[]>("crosswalks");
const converted = fixture<ConvertedCounts>("convert-sample");
const table = readTable(readFileSync("public/fix/sample-wards.csv", "utf8"));
const diagnosis = diagnose(sampleInput());
const WARDS_2024 = { geography: "ward", boundaryRelease: "2024-12-uk-bgc" };

describe("convertChoices", () => {
	it("offers other geographies the matched wards convert to, newest first", () => {
		const choices = convertChoices(WARDS_2024, crosswalks, releases);
		expect(choices.map((choice) => choice.id)).toEqual([
			"ward-2024-12-uk-bgc-to-local-authority-2024-12-uk-bgc-clean-containment",
			"ward-2024-12-uk-bgc-to-local-authority-2024-05-uk-bgc-clean-containment",
		]);
		expect(choices[0]).toMatchObject({
			header: "local_authority",
			weighting: undefined,
		});
	});

	it("opts in to a crosswalk's published weights", () => {
		const weighted: Crosswalk = {
			...crosswalks[0],
			id: "weighted",
			from: WARDS_2024,
			to: {
				geography: "constituency",
				boundaryRelease: "2024-07-uk-bgc",
			},
			method: "area-overlap",
			weighting: { status: "provided", basis: "area" },
		};
		expect(
			convertChoices(WARDS_2024, [weighted], releases)[0].weighting,
		).toBe("area");
	});
});

describe("countInput", () => {
	it("sends each matched row's code and count, and lists the rest", () => {
		const input = countInput(table, diagnosis, 2);
		expect(input.rows).toHaveLength(26);
		expect(input.rows[0]).toEqual({ code: "E05013400", value: 3422 });
		expect(input.leftOut).toEqual([
			{ line: 17, value: "E0513457", reason: "area not matched" },
		]);
		expect(input.repeats).toEqual([]);
	});

	it("leaves out cells that are not counts, and flags repeated areas", () => {
		const edited = {
			...table,
			rows: table.rows.map((row, i) =>
				i === 0
					? [row[0], row[1], "n/a"]
					: i === 1
						? [row[0], row[1], ""]
						: row,
			),
		};
		const repeated = {
			...diagnosis,
			results: [
				...diagnosis.results,
				{ ...diagnosis.results[2], row: 27 },
			],
		};
		edited.rows.push([...table.rows[2]]);
		const input = countInput(edited, repeated, 2);
		expect(input.leftOut.slice(0, 2)).toEqual([
			{ line: 2, value: "E05013400", reason: "not a count" },
			{ line: 3, value: "E05013403", reason: "no value" },
		]);
		expect(input.repeats).toEqual([
			{ line: 29, value: "E05013408", reason: "same area as line 4" },
		]);
	});
});

describe("convertedTable", () => {
	it("gives each target area its total and how much of it the file covers", () => {
		const result = convertedTable(
			[{ header: "households", result: converted }],
			"local_authority",
			new Map([["E06000054", "Wiltshire"]]),
			"wards",
		);
		expect(result.headers).toEqual([
			"local_authority_code",
			"local_authority_name",
			"households",
			"households_coverage",
		]);
		expect(result.rows).toEqual([
			["E06000054", "Wiltshire", "85666", "partial: 26 of 98 wards"],
		]);
	});

	it("leaves an area blank in a column that did not reach it", () => {
		const other: ConvertedCounts = {
			...converted,
			records: [
				{
					areaCode: "E06000001",
					value: 2.5,
					inputAreaCount: 1,
					coverage: {
						status: "complete",
						sourceCount: 1,
						suppliedSourceCount: 1,
					},
				},
			],
		};
		const result = convertedTable(
			[
				{ header: "households", result: converted },
				{ header: "households", result: other },
			],
			"local_authority",
			new Map(),
			"wards",
		);
		expect(result.headers.slice(2)).toEqual([
			"households",
			"households_coverage",
			"households_2",
			"households_coverage_2",
		]);
		expect(result.rows).toEqual([
			["E06000001", "", "", "", "2.5", "complete"],
			["E06000054", "", "85666", "partial: 26 of 98 wards", "", ""],
		]);
	});
});
