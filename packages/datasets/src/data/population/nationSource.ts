import { parseCsv } from "../../helpers/parseCsv.ts";
import type { DirectPart, DirectValue } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";

/**
 * Mid-year population estimates by single year of age and sex for the
 * authorities of the two nations the ONS back series lags behind: Scotland's
 * council areas, from National Records of Scotland, and Northern Ireland's
 * local government districts, from NISRA. Each is the publisher's own file,
 * read on the authority boundaries the atlas already holds for the nation.
 *
 * Both publish single years of age 0 to 89 and 90 and over, the members the
 * atlas's age dimension has, so no band is mapped and none is split.
 */

type Records = Map<string, { name: string; values: DirectValue[] }>;

/** The parts of a read, one per mid-year in order, each with its areas by code. */
const partsOf = (years: Map<number, Records>): DirectPart[] =>
	[...years]
		.sort(([a], [b]) => a - b)
		.map(([year, records]) => ({
			key: String(year),
			records: [...records]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([code, { name, values }]) => ({ code, name, values })),
		}));

/** A whole number from a cell, or an error that names the cell. */
const count = (text: string | undefined, where: string): number => {
	const value = Number((text ?? "").trim().replace(/,/g, ""));
	if (!/^\d/.test((text ?? "").trim()) || !Number.isInteger(value))
		throw new Error(`${where}: "${text}" is not a whole number`);
	return value;
};

/** The record of an area and year, made where it is first read. */
const recordOf = (
	years: Map<number, Records>,
	year: number,
	code: string,
	name: string,
) => {
	const records = years.get(year) ?? new Map();
	years.set(year, records);
	const record = records.get(code) ?? { name, values: [] };
	records.set(code, record);
	return record;
};

/**
 * Where a council area's code in an earlier year stands now. The time series
 * files every year under the code the area had then: the 1995 codes to 2001,
 * the 2011 codes from 2002, Fife and Perth and Kinross re-coded in 2018 and
 * Glasgow City and North Lanarkshire in 2019, each for a very minor boundary
 * change. Where the code is the area's current one it is not listed.
 */
export const COUNCIL_AREA_CURRENT_CODE: Readonly<Record<string, string>> = {
	S12000001: "S12000033", // Aberdeen City
	S12000002: "S12000034", // Aberdeenshire
	S12000003: "S12000041", // Angus
	S12000004: "S12000035", // Argyll and Bute
	S12000007: "S12000042", // Dundee City
	S12000009: "S12000045", // East Dunbartonshire
	S12000012: "S12000036", // City of Edinburgh
	S12000015: "S12000047", // Fife
	S12000016: "S12000049", // Glasgow City
	S12000022: "S12000050", // North Lanarkshire
	S12000024: "S12000048", // Perth and Kinross
	S12000025: "S12000038", // Renfrewshire
	S12000031: "S12000039", // West Dunbartonshire
	S12000032: "S12000040", // West Lothian
	S12000044: "S12000050", // North Lanarkshire
	S12000046: "S12000049", // Glasgow City
};

const COUNCIL_AREA_CODE = /^S12\d{6}$/;

const NRS_SEX: Readonly<Record<string, string>> = {
	persons: "all",
	males: "male",
	females: "female",
};

/**
 * Scotland's council areas by sex and single year of age, one part per
 * mid-year. The time series sheet has a title above its header, a row of
 * Scotland, and one row per area, sex and year with a column for each age.
 * The national rows are not areas of a release and are left out.
 */
export async function populationCouncilScotlandStatisticsParts(
	readSheet: (path: string, sheet: string) => Promise<string>,
	path = sourceDir(
		"population-council-scotland",
		"mid-year-population-estimates-time-series-data.xlsx",
	),
): Promise<DirectPart[]> {
	const { data } = await parseCsv<string[]>(
		await readSheet(path, "Table 1"),
		{
			header: false,
		},
	);
	const rows = data as string[][];
	const head = rows.findIndex((row) => row[0]?.trim() === "Area code");
	if (head < 0) throw new Error(`${path}: no "Area code" header in Table 1`);
	const header = rows[head]!.map((cell) => cell.trim());
	const found = ["Area code", "Area name", "Sex", "Year"].map((label) =>
		header.indexOf(label),
	);
	if (found.some((column) => column < 0))
		throw new Error(`${path}: Table 1 lacks an area, sex or year column`);
	const [code, name, sex, year] = found as [number, number, number, number];
	const ages = header.flatMap((label, column) => {
		const age = /^\d+$/.test(label)
			? Number(label)
			: label === "90 and over"
				? 90
				: undefined;
		return age === undefined ? [] : [{ column, age }];
	});
	if (ages.length !== 91)
		throw new Error(
			`${path}: expected 91 age columns, found ${ages.length}`,
		);

	const years = new Map<number, Records>();
	const seen = new Set<string>();
	for (const row of rows.slice(head + 1)) {
		const published = row[code]?.trim() ?? "";
		if (!COUNCIL_AREA_CODE.test(published)) continue;
		const members = NRS_SEX[(row[sex] ?? "").trim().toLowerCase()];
		if (!members) throw new Error(`${path}: unknown sex "${row[sex]}"`);
		const mid = Number(row[year]?.trim());
		const current = COUNCIL_AREA_CURRENT_CODE[published] ?? published;
		const key = `${mid}|${current}|${members}`;
		if (seen.has(key))
			throw new Error(
				`${path}: ${current} has two ${members} rows for ${mid}`,
			);
		seen.add(key);
		const record = recordOf(years, mid, current, row[name]!.trim());
		for (const { column, age } of ages)
			record.values.push({
				measure: "population",
				members: { sex: members, age: String(age) },
				value: count(
					row[column],
					`${path}: ${published} ${mid} age ${age}`,
				),
			});
	}
	return partsOf(years);
}

const DISTRICT_CODE = /^N09\d{6}$/;

const NISRA_SEX: Readonly<Record<string, string>> = {
	"all persons": "all",
	males: "male",
	females: "female",
};

/**
 * Northern Ireland's local government districts by sex and single year of
 * age, one part per mid-year. The `Flat` sheet has a row for each area, year,
 * sex and age, with 90 meaning 90 and over, and rows for Northern Ireland as a
 * whole, which are not districts and are left out.
 */
export async function populationDistrictNiStatisticsParts(
	readSheet: (path: string, sheet: string) => Promise<string>,
	path = sourceDir("population-district-ni", "MYE25-SYA.xlsx"),
): Promise<DirectPart[]> {
	const { data } = await parseCsv<string[]>(await readSheet(path, "Flat"), {
		header: false,
	});
	const rows = data as string[][];
	const header = (rows[0] ?? []).map((cell) => cell.trim());
	const columns = ["area_code", "area_name", "year", "sex", "age", "MYE"].map(
		(label) => header.indexOf(label),
	);
	if (columns.some((column) => column < 0))
		throw new Error(`${path}: Flat lacks one of its six columns`);
	const [code, name, year, sex, age, value] = columns as [
		number,
		number,
		number,
		number,
		number,
		number,
	];

	const years = new Map<number, Records>();
	const seen = new Set<string>();
	for (const row of rows.slice(1)) {
		const published = row[code]?.trim() ?? "";
		if (!DISTRICT_CODE.test(published)) continue;
		const members = NISRA_SEX[(row[sex] ?? "").trim().toLowerCase()];
		if (!members) throw new Error(`${path}: unknown sex "${row[sex]}"`);
		const mid = Number(row[year]?.trim());
		const old = Number(row[age]?.trim());
		if (!Number.isInteger(old) || old < 0 || old > 90)
			throw new Error(`${path}: age "${row[age]}" is not 0 to 90`);
		const key = `${mid}|${published}|${members}|${old}`;
		if (seen.has(key))
			throw new Error(
				`${path}: ${published} has two ${members} rows for ${mid} at ${old}`,
			);
		seen.add(key);
		recordOf(years, mid, published, row[name]!.trim()).values.push({
			measure: "population",
			members: { sex: members, age: String(old) },
			value: count(row[value], `${path}: ${published} ${mid} age ${old}`),
		});
	}
	return partsOf(years);
}
