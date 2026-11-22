import type { DatasetReader } from "../catalog/types.ts";
import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";

/**
 * Mid-year population estimates for the smallest statistical areas of each
 * nation, read as the published total of persons of all ages. Each is stored
 * as the `sex=all` member, the series the population conversion adds up, so a
 * total reaches every ward, council and constituency release a crosswalk
 * reaches. The single years of age are left in the workbooks: on 47,000 areas
 * and 14 years they would multiply the atlas for a breakdown the standard
 * releases already carry.
 */

type ReadRows = DatasetReader["xlsxSheetSelectedRows"];

/** One area's persons total for one year. */
const record = (code: string, name: string | undefined, value: number) =>
	({
		code,
		...(name ? { name } : {}),
		values: [{ measure: "population", members: { sex: "all" }, value }],
	}) satisfies DirectRecord;

/** A published count of people, which must be a whole number. */
const count = (text: string | undefined, what: string): number => {
	const value = Number(text?.trim());
	if (!text?.trim() || !Number.isInteger(value) || value < 0)
		throw new Error(
			`${what}: unreadable population ${JSON.stringify(text)}`,
		);
	return value;
};

/**
 * One owned copy of each distinct cell text. A reader's text can be a slice of
 * the whole sheet's text, and a held slice keeps all of it alive: the 14 NRS
 * workbooks held 300 MB for 100,000 records. The same codes and names also
 * repeat every year, so one copy serves them all.
 */
const sharedText = () => {
	const copies = new Map<string, string>();
	return (text: string): string => {
		let copy = copies.get(text);
		if (copy === undefined) {
			copy = Buffer.from(text, "utf8").toString("utf8");
			copies.set(copy, copy);
		}
		return copy;
	};
};

/** Parts in year order, with a check that each year holds every area. */
const partsOf = (
	label: string,
	years: Map<number, Map<string, DirectRecord>>,
	expected: number,
): DirectPart[] =>
	[...years]
		.sort(([a], [b]) => a - b)
		.map(([year, records]) => {
			if (records.size !== expected)
				throw new Error(
					`${label} ${year}: expected ${expected} areas, found ${records.size}`,
				);
			return { key: String(year), records: [...records.values()] };
		});

// ONS: Lower layer Super Output Areas, England and Wales.

/** The 2021 LSOAs of England and Wales. */
export const LSOA_2021_COUNT = 35_672;

const LSOA_CODE = /^[EW]01\d{6}$/;

/**
 * The ONS workbooks and the mid-years each is read for. Mid-2022 is published
 * twice; the November 2025 revision, consistent with the later years, is used.
 */
export const POPULATION_LSOA_WORKBOOKS = {
	"sapelsoasyoa20112014.xlsx": [2011, 2012, 2013, 2014],
	"sapelsoasyoa20152018.xlsx": [2015, 2016, 2017, 2018],
	"sapelsoasyoa20192022.xlsx": [2019, 2020, 2021],
	"sapelsoasyoa20222024.xlsx": [2022, 2023, 2024],
} as const;

/** Column positions of a mid-year sheet: LSOA code and name, and the total. */
const LSOA_COLUMNS = [2, 3, 4] as const;

/** One "Mid-YYYY LSOA 2021" sheet's LSOA totals, checking its header. */
export async function populationLsoaYear(
	readRows: ReadRows,
	path: string,
	year: number,
	own = sharedText(),
): Promise<Map<string, DirectRecord>> {
	const sheet = `Mid-${year} LSOA 2021`;
	const records = new Map<string, DirectRecord>();
	let header = false;
	await readRows(path, sheet, LSOA_COLUMNS, (row) => {
		if (!header) {
			if (row.get(2)?.trim() !== "LSOA 2021 Code") return;
			if (row.get(4)?.trim() !== "Total")
				throw new Error(`${path} ${sheet}: expected Total in column 5`);
			header = true;
			return;
		}
		const code = own(row.get(2)?.trim() ?? "");
		if (!LSOA_CODE.test(code)) return;
		if (records.has(code))
			throw new Error(`${path} ${sheet}: ${code} appears twice`);
		records.set(
			code,
			record(
				code,
				own(row.get(3)?.trim() ?? ""),
				count(row.get(4), `${sheet} ${code}`),
			),
		);
	});
	if (!header) throw new Error(`${path} ${sheet}: no header row`);
	return records;
}

/** Every mid-year of the ONS LSOA estimates, 2011 to 2024. */
export async function populationLsoaStatisticsParts(
	readRows: ReadRows,
	expected = LSOA_2021_COUNT,
): Promise<DirectPart[]> {
	const years = new Map<number, Map<string, DirectRecord>>();
	const own = sharedText();
	for (const [file, fileYears] of Object.entries(POPULATION_LSOA_WORKBOOKS))
		for (const year of fileYears)
			years.set(
				year,
				await populationLsoaYear(
					readRows,
					sourceDir("population-lsoa", file),
					year,
				),
			);
	return partsOf("LSOA population", years, expected);
}

// NRS: 2022 data zones, Scotland.

/** Scotland's 2022 data zones. */
export const DATA_ZONE_2022_COUNT = 7_392;

const SCOTTISH_DATA_ZONE = /^S01\d{6}$/;

/** The mid-years NRS publishes on the 2022 data zones, one workbook each. */
export const POPULATION_DATA_ZONE_SCOTLAND_YEARS = Array.from(
	{ length: 14 },
	(_, index) => 2011 + index,
);

/** Data zone code and name, sex, and the total population. */
const NRS_COLUMNS = [0, 1, 4, 5] as const;

/** One "SAPE YYYY.xlsx" workbook's persons totals, checking its header. */
export async function populationDataZoneScotlandYear(
	readRows: ReadRows,
	path: string,
	year: number,
	own = sharedText(),
): Promise<Map<string, DirectRecord>> {
	const records = new Map<string, DirectRecord>();
	let header = false;
	await readRows(path, String(year), NRS_COLUMNS, (row) => {
		if (!header) {
			if (row.get(0)?.trim() !== "Data zone code") return;
			if (
				row.get(4)?.trim() !== "Sex" ||
				row.get(5)?.trim() !== "Total population"
			)
				throw new Error(
					`${path}: expected Sex and Total population in columns 5 and 6`,
				);
			header = true;
			return;
		}
		const code = own(row.get(0)?.trim() ?? "");
		if (!SCOTTISH_DATA_ZONE.test(code)) return;
		if (row.get(4)?.trim() !== "Persons") return;
		if (records.has(code))
			throw new Error(`${path}: ${code} appears twice`);
		records.set(
			code,
			record(
				code,
				own(row.get(1)?.trim() ?? ""),
				count(row.get(5), `${year} ${code}`),
			),
		);
	});
	if (!header) throw new Error(`${path}: no header row`);
	return records;
}

/** Every mid-year of the NRS 2022 data zone estimates, 2011 to 2024. */
export async function populationDataZoneScotlandStatisticsParts(
	readRows: ReadRows,
	expected = DATA_ZONE_2022_COUNT,
): Promise<DirectPart[]> {
	const years = new Map<number, Map<string, DirectRecord>>();
	const own = sharedText();
	for (const year of POPULATION_DATA_ZONE_SCOTLAND_YEARS)
		years.set(
			year,
			await populationDataZoneScotlandYear(
				readRows,
				sourceDir("population-data-zone-scotland", `SAPE ${year}.xlsx`),
				year,
			),
		);
	return partsOf("Scottish data zone population", years, expected);
}

// NISRA: 2021 data zones, Northern Ireland.

/** Northern Ireland's 2021 data zones. */
export const DATA_ZONE_NI_2021_COUNT = 3_780;

const NI_DATA_ZONE = /^N20\d{6}$/;

/** Area, code, year and estimate: the workbook's long table. */
const NISRA_COLUMNS = [0, 1, 2, 3] as const;

/**
 * The NISRA data zone workbook's "Flat" sheet: one row per data zone and year.
 * It names the zones by code only.
 */
export async function populationDataZoneNiStatisticsParts(
	readRows: ReadRows,
	expected = DATA_ZONE_NI_2021_COUNT,
	path = sourceDir("population-data-zone-ni", "MYE24_DZ.xlsx"),
): Promise<DirectPart[]> {
	const years = new Map<number, Map<string, DirectRecord>>();
	const own = sharedText();
	let header = false;
	await readRows(path, "Flat", NISRA_COLUMNS, (row) => {
		if (!header) {
			const names = NISRA_COLUMNS.map((column) =>
				row.get(column)?.trim(),
			);
			if (names.join() !== "Area,Area_Code,Year,MYE")
				throw new Error(
					`${path} Flat: expected Area, Area_Code, Year, MYE, found ${names.join(", ")}`,
				);
			header = true;
			return;
		}
		const code = own(row.get(1)?.trim() ?? "");
		if (!NI_DATA_ZONE.test(code)) return;
		const year = count(row.get(2), `${path} ${code} year`);
		const records = years.get(year) ?? new Map<string, DirectRecord>();
		years.set(year, records);
		if (records.has(code))
			throw new Error(`${path}: ${code} appears twice for ${year}`);
		records.set(
			code,
			record(code, undefined, count(row.get(3), `${year} ${code}`)),
		);
	});
	if (!header) throw new Error(`${path} Flat: no header row`);
	return partsOf("Northern Ireland data zone population", years, expected);
}
