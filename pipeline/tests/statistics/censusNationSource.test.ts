import { expect, test } from "vitest";
import {
	northernIrelandRecords,
	scotlandRecords,
} from "../../src/statistics/censusNationSource.ts";
import {
	CENSUS_NATION_TABLES,
	censusNationMembers,
} from "../../src/statistics/censusNationTables.ts";

const table = (dataset: string) =>
	CENSUS_NATION_TABLES.find((each) => each.dataset === dataset)!;

const scotlandCodes = Array.from(
	{ length: 7_392 },
	(_, index) => `S01${String(index + 1).padStart(6, "0")}`,
);

/** A Scotland CSV with every data zone, `cell` giving the text of each count. */
const scotlandCsv = (
	dataset: string,
	cell: (code: string, key: string) => string,
	codes = scotlandCodes,
) => {
	const found = table(dataset);
	const lines = ['"Data Zone","Label","Count"'];
	for (const code of codes)
		for (const [, key] of found.categories)
			lines.push(
				[
					`"${code}"`,
					...key.split("|").map((part) => `"${part}"`),
					`"${cell(code, key)}"`,
				].join(","),
			);
	return lines.join("\r\n");
};

test("reads Scotland's counts in category order, one row per data zone", () => {
	const found = table("census-2022-scotland-uv302");
	const records = scotlandRecords(
		scotlandCsv("census-2022-scotland-uv302", (_, key) =>
			String(found.categories.findIndex(([, each]) => each === key) + 1),
		),
		found,
	);
	expect(records).toHaveLength(7_392);
	expect(records[0]).toEqual(["S01000001", 1, 2, 3, 4, 5, 6]);
});

test("reads a dash in Scotland's files as zero", () => {
	const found = table("census-2022-scotland-uv302");
	const records = scotlandRecords(
		scotlandCsv("census-2022-scotland-uv302", (code) =>
			code === "S01000002" ? "-" : "7",
		),
		found,
	);
	expect(records[1]).toEqual(["S01000002", 0, 0, 0, 0, 0, 0]);
	expect(records[0]).toEqual(["S01000001", 7, 7, 7, 7, 7, 7]);
});

test("refuses a Scotland file with a data zone missing, a repeat or a bad count", () => {
	const found = table("census-2022-scotland-uv302");
	expect(() =>
		scotlandRecords(
			scotlandCsv(
				"census-2022-scotland-uv302",
				() => "1",
				scotlandCodes.slice(1),
			),
			found,
		),
	).toThrow(/7391 data zones, expected 7392/);
	expect(() =>
		scotlandRecords(
			scotlandCsv("census-2022-scotland-uv302", () => "1.5"),
			found,
		),
	).toThrow(/is not a count/);
	const csv = scotlandCsv("census-2022-scotland-uv302", () => "1");
	const first = csv.split("\r\n")[1]!;
	expect(() => scotlandRecords(`${csv}\r\n${first}`, found)).toThrow(
		/repeats/,
	);
});

const niCodes = Array.from(
	{ length: 3_780 },
	(_, index) => `N20${String(index + 1).padStart(6, "0")}`,
);

/** A Northern Ireland sheet: notes above a heading row, then a row per data zone. */
const niSheet = (
	heading: string,
	value: (code: string) => string,
	codes = niCodes,
) => [
	["Table MS-A01"],
	["Geography name", "Geography code", heading],
	...codes.map((code) => [`Zone ${code}`, code, value(code)]),
	["Northern Ireland", "N92000002", "1903175"],
];

test("reads Northern Ireland's data zone sheet by its heading", () => {
	const found = table("census-2021-ni-a01");
	const records = northernIrelandRecords(
		niSheet("All usual residents", (code) => String(Number(code.slice(3)))),
		found,
	);
	expect(records).toHaveLength(3_780);
	expect(records[0]).toEqual(["N20000001", 1]);
	expect(records.at(-1)).toEqual(["N20003780", 3_780]);
});

test("refuses a Northern Ireland sheet without the heading or a data zone", () => {
	const found = table("census-2021-ni-a01");
	expect(() =>
		northernIrelandRecords(
			niSheet("Something else", () => "1"),
			found,
		),
	).toThrow(/no column All usual residents/);
	expect(() =>
		northernIrelandRecords(
			niSheet("All usual residents", () => "1", niCodes.slice(1)),
			found,
		),
	).toThrow(/3779 data zones, expected 3780/);
});

test("every category joins a category of the England and Wales table", () => {
	for (const each of CENSUS_NATION_TABLES) {
		const members = censusNationMembers(each);
		expect(members).toHaveLength(each.categories.length);
		for (const member of members)
			expect(Object.keys(member)).toEqual([each.joins.dimension]);
	}
});
