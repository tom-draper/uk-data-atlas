import { describe, expect, it } from "vitest";
import { populationConstituencyYear } from "@uk-data-atlas/datasets";

const AGES = Array.from({ length: 91 }, (_, age) => age);

// Three preamble lines, then the header, then England's and Wales's rows.
const sheet = (rows: string[]) =>
	[
		"Estimates by single year of age and sex for 2025 Parliamentary Constituencies, mid-2022",
		"This worksheet contains one table.",
		"To turn off freeze panes select the 'View' ribbon",
		[
			"PCON 2025 Code",
			"PCON 2025 Name",
			"Total",
			...AGES.map((age) => `F${age}`),
			...AGES.map((age) => `M${age}`),
		].join(","),
		...rows,
	].join("\n");

/** A row whose given ages hold the given counts and every other age holds 1. */
const row = (
	code: string,
	name: string,
	total: string,
	counts: Record<string, string> = {},
) =>
	[
		code,
		name,
		total,
		...AGES.map((age) => counts[`F${age}`] ?? "1"),
		...AGES.map((age) => counts[`M${age}`] ?? "1"),
	].join(",");

describe("populationConstituencyYear", () => {
	it("reads each constituency's published total", async () => {
		const part = await populationConstituencyYear(
			2022,
			sheet([
				row("E14001063", "Aldershot", "119256"),
				row("W07000081", "Aberafan Maesteg", "90000"),
				"Source: ONS,,,,",
			]),
		);

		expect(part.key).toBe("2022");
		expect(part.records.map((record) => record.code)).toEqual([
			"E14001063",
			"W07000081",
		]);
		expect(part.records[0]!.name).toBe("Aldershot");
		expect(part.records[0]!.values[0]).toEqual({
			measure: "population",
			value: 119256,
		});
		expect(part.records[1]!.values[0]).toEqual({
			measure: "population",
			value: 90000,
		});
	});

	it("reads each single year of age by sex, and sums them for everyone", async () => {
		const part = await populationConstituencyYear(
			2022,
			sheet([
				row("E14001063", "Aldershot", "119256", {
					F0: "678",
					M0: "700",
					F90: "40",
					M90: "25",
				}),
			]),
		);

		const at = (sex: string, age: string) =>
			part.records[0]!.values.find(
				(value) =>
					value.members?.sex === sex && value.members?.age === age,
			)?.value;
		expect(at("female", "0")).toBe(678);
		expect(at("male", "0")).toBe(700);
		expect(at("all", "0")).toBe(1378);
		expect(at("female", "90")).toBe(40);
		expect(at("male", "90")).toBe(25);
		expect(at("all", "90")).toBe(65);
		expect(at("all", "45")).toBe(2);
		// The total, then every age for each of the three sexes.
		expect(part.records[0]!.values).toHaveLength(1 + 91 * 3);
	});

	it("refuses a constituency with no usable total", async () => {
		await expect(
			populationConstituencyYear(
				2022,
				sheet([row("E14001063", "Aldershot", "")]),
			),
		).rejects.toThrow(/unreadable total for E14001063/);
	});

	it("refuses a constituency with an unreadable count for an age", async () => {
		await expect(
			populationConstituencyYear(
				2022,
				sheet([row("E14001063", "Aldershot", "119256", { F1: "" })]),
			),
		).rejects.toThrow(/unreadable F1 for E14001063/);
	});
});
