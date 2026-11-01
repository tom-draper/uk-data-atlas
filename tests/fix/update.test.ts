import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diagnose } from "@/lib/fix/diagnose";
import { readTable } from "@/lib/fix/table";
import {
	changeCounts,
	rowUpdates,
	updatedTable,
	type UpdateOptions,
} from "@/lib/fix/update";
import { sampleInput } from "./sample";

const table = readTable(readFileSync("public/fix/sample-wards.csv", "utf8"));
const diagnosis = diagnose(sampleInput());

const options = (overrides: Partial<UpdateOptions> = {}): UpdateOptions => ({
	codes: "add",
	splits: "list",
	name: false,
	parents: [],
	...overrides,
});

/** The sample's rows by their first cell, the ward code. */
function byCode(result: { headers: string[]; rows: string[][] }) {
	return (code: string) =>
		result.rows
			.filter((row) => row[0] === code)
			.map((row) =>
				Object.fromEntries(
					result.headers.map((header, i) => [header, row[i]]),
				),
			);
}

describe("rowUpdates", () => {
	it("moves each row of the sample to the latest release", () => {
		expect(changeCounts(rowUpdates(diagnosis))).toMatchObject({
			current: 21,
			updated: 4,
			split: 1,
			"not-matched": 1,
		});
	});

	it("gives a split row every area it became", () => {
		const update = rowUpdates(diagnosis).get(11);
		expect(update?.change).toBe("split");
		expect(update?.areas.map((a) => a.code).sort()).toEqual([
			"E05016253",
			"E05016254",
		]);
	});

	it("gives a repeated retired code its first row's successor", () => {
		const repeated = {
			...diagnosis,
			results: [
				...diagnosis.results,
				{
					row: 27,
					value: "E05013408",
					status: "valid" as const,
					latestStatus: "superseded" as const,
					duplicateOf: 2,
				},
			],
		};
		expect(rowUpdates(repeated).get(27)).toEqual({
			change: "updated",
			areas: [{ code: "E05016249", name: "Brinkworth" }],
		});
	});
});

describe("updatedTable", () => {
	it("adds the latest code beside the old one and says what changed", () => {
		const result = updatedTable(table, diagnosis, 0, options());
		expect(result.headers).toEqual([
			"ward_cd",
			"latest_code",
			"area_update",
			"ward_name",
			"households",
		]);
		const row = byCode(result);
		expect(row("E05013408")).toEqual([
			{
				ward_cd: "E05013408",
				latest_code: "E05016249",
				area_update: "updated",
				ward_name: "Brinkworth",
				households: "4478",
			},
		]);
		expect(row("E05013400")[0]).toMatchObject({
			latest_code: "E05013400",
			area_update: "current",
		});
		expect(row("E0513457")[0]).toMatchObject({
			latest_code: "",
			area_update: "not a valid code",
		});
	});

	it("lists a split's new codes on its one row", () => {
		const split = byCode(updatedTable(table, diagnosis, 0, options()))(
			"E05013446",
		);
		expect(split).toHaveLength(1);
		expect(split[0].latest_code.split(" | ").sort()).toEqual([
			"E05016253",
			"E05016254",
		]);
		expect(split[0].area_update).toMatch(/^split into E0501625\d, /);
	});

	it("gives a split one row per new area when asked", () => {
		const result = updatedTable(
			table,
			diagnosis,
			0,
			options({ codes: "replace", splits: "rows" }),
		);
		expect(result.rows).toHaveLength(table.rows.length + 1);
		const split = result.rows.filter((row) =>
			["E05016253", "E05016254"].includes(row[0]),
		);
		expect(split.map((row) => row[3])).toEqual(["1946", "1946"]);
		expect(split.map((row) => row[1])).toEqual(["split", "split"]);
	});

	it("writes the latest code over a retired one, and keeps codes it cannot move", () => {
		const result = updatedTable(
			table,
			diagnosis,
			0,
			options({ codes: "replace" }),
		);
		expect(result.headers).toEqual([
			"ward_cd",
			"area_update",
			"ward_name",
			"households",
		]);
		const column = result.rows.map((row) => row[0]);
		expect(column).toContain("E05016249");
		expect(column).not.toContain("E05013408");
		expect(column).toContain("E0513457");
		// A split has no one code to write, so it keeps the old one.
		expect(column).toContain("E05013446");
	});

	it("adds the latest name and parent areas from a lookup", () => {
		const result = updatedTable(
			table,
			diagnosis,
			0,
			options({
				codes: "keep",
				name: true,
				parents: [
					{
						header: "local_authority",
						lookup: new Map([
							[
								"E05016249",
								[{ code: "E06000054", name: "Wiltshire" }],
							],
						]),
					},
				],
			}),
		);
		expect(result.headers.slice(0, 5)).toEqual([
			"ward_cd",
			"area_name",
			"local_authority_code",
			"local_authority_name",
			"area_update",
		]);
		expect(byCode(result)("E05013408")[0]).toMatchObject({
			area_name: "Brinkworth",
			local_authority_code: "E06000054",
			local_authority_name: "Wiltshire",
		});
	});

	it("does not reuse a header the file already has", () => {
		const clash = { ...table, headers: ["ward_cd", "area_update", "x"] };
		const result = updatedTable(clash, diagnosis, 0, options());
		expect(result.headers).toEqual([
			"ward_cd",
			"latest_code",
			"area_update_2",
			"area_update",
			"x",
		]);
	});
});
