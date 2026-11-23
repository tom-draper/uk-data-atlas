import type {
	DirectPart,
	DirectRecord,
	DirectValue,
} from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { findHeaderLine, parseCsv } from "../../helpers/parseCsv.ts";
import { parseNullableNum as parseNumber } from "../../helpers/parseNumber.ts";

type Period = "annual" | "hourly";
type Place = "residence" | "workplace";

const PERCENTILES = [10, 20, 25, 30, 40, 60, 70, 75, 80, 90];

/** One authority's pay figures, as one workbook sheet gives them. */
type PayRow = { name: string; values: DirectValue[] };

/**
 * The countries and English regions, by the name the 2012 to 2015 editions
 * give them. Those editions leave the code of a country or region blank;
 * from 2016 every row carries one.
 */
const CODES_BY_NAME: Record<string, string> = {
	England: "E92000001",
	"Wales / Cymru": "W92000004",
	Scotland: "S92000003",
	"North East": "E12000001",
	"North West": "E12000002",
	"Yorkshire and The Humber": "E12000003",
	"East Midlands": "E12000004",
	"West Midlands": "E12000005",
	East: "E12000006",
	London: "E12000007",
	"South East": "E12000008",
	"South West": "E12000009",
};

/**
 * Whether the atlas holds the area. England, Wales and Scotland are kept, as
 * the nations, regions, counties and authorities the tables publish for them.
 * Northern Ireland has no authority rows in these tables, the United Kingdom,
 * Great Britain and England and Wales totals are not areas, and the
 * metropolitan counties and Inner and Outer London are not atlas areas.
 */
const isAtlasArea = (code: string): boolean =>
	/^[EWS]/.test(code) && !code.startsWith("E11") && !code.startsWith("E13");

async function payRows(
	text: string,
	period: Period,
	place: Place,
): Promise<Map<string, PayRow>> {
	const skipLines = findHeaderLine(text, "Description");
	const { data } = await parseCsv(text, { header: true, skipLines });
	const rows = new Map<string, PayRow>();
	for (const row of data) {
		const description = row["Description"]?.trim();
		const code = row["Code"]?.trim() || CODES_BY_NAME[description ?? ""];
		if (!code || !description || code === "Code" || !isAtlasArea(code))
			continue;

		const median = parseNumber(row["Median"]);
		const mean = parseNumber(row["Mean"]);
		if (median === null && mean === null) continue;

		const earnings = { "earnings-place": place };
		const pay = (statistic: string, value: number | null) => ({
			measure: `gross-${period}-pay`,
			members: { ...earnings, "pay-statistic": statistic },
			value,
		});
		const change = (statistic: string, value: number | null) => ({
			measure: `gross-${period}-pay-change`,
			members: { ...earnings, "pay-statistic": statistic },
			value,
		});
		rows.set(code, {
			name: description,
			values: [
				{
					measure: "ashe-jobs",
					members: { ...earnings, "pay-period": period },
					value: parseNumber(row["(thousand)"]),
				},
				pay("median", median),
				change("median", parseNumber(row["change"])),
				pay("mean", mean),
				change("mean", parseNumber(row["change_1"])),
				...PERCENTILES.map((percentile) =>
					pay(`p${percentile}`, parseNumber(row[String(percentile)])),
				),
			],
		});
	}
	return rows;
}

/** The workbooks of one year: annual and hourly gross pay. */
export type PayFiles = { annual: string; hourly: string };

/**
 * The Annual Survey of Hours and Earnings tables for one year: annual and
 * hourly gross pay of each area, from the table of residence or workplace
 * earnings.
 */
export async function payStatisticsPart(
	key: string,
	read: (path: string) => Promise<string>,
	place: Place,
	files: PayFiles,
): Promise<DirectPart> {
	const [annual, hourly] = await Promise.all([
		payRows(await read(files.annual), "annual", place),
		payRows(await read(files.hourly), "hourly", place),
	]);
	const records = new Map<string, DirectRecord>();
	for (const code of new Set([...annual.keys(), ...hourly.keys()])) {
		const rows = [annual.get(code), hourly.get(code)];
		records.set(code, {
			code,
			name: annual.get(code)?.name ?? hourly.get(code)?.name ?? "",
			values: rows.flatMap((row) => row?.values ?? []),
		});
	}
	return { key, records: [...records.values()] };
}

/** The first and last year of the earlier editions, which are final results. */
const HISTORY_YEARS = { first: 2012, last: 2024 };

/** The table number, the file prefix and the tables' names for each place. */
const TABLES = {
	residence: { table: 8, geography: "Home" },
	workplace: { table: 7, geography: "Work" },
} as const;

/**
 * The workbooks of one earlier year. Editions to 2022 are `.xls` files and
 * those from 2023 are `.xlsx`.
 */
const historyFiles = (place: Place, year: number): PayFiles => {
	const { table, geography } = TABLES[place];
	const extension = year >= 2023 ? "xlsx" : "xls";
	const file = (number: number, name: string) =>
		sourceDir(
			"income-history",
			`table-${table}/${year}/${geography} Geography Table ${table}.${number}a   ${name} - Gross ${year}.${extension}`,
		);
	return { annual: file(7, "Annual pay"), hourly: file(5, "Hourly pay") };
};

/** The 2025 edition, the provisional results the atlas first held. */
const currentFiles = (place: Place): PayFiles => {
	const { table, geography } = TABLES[place];
	const file = (number: number, name: string) =>
		sourceDir(
			"income",
			`table-${table}/PROV - ${geography} Geography Table ${table}.${number}a   ${name} - Gross 2025.xlsx`,
		);
	return { annual: file(7, "Annual pay"), hourly: file(5, "Hourly pay") };
};

/**
 * Every year of the tables, 2012 to 2024 from the final results and 2025 from
 * the provisional ones, one part each. Every edition's "All" sheet covers
 * every employee job.
 */
export async function payStatisticsParts(
	read: (path: string) => Promise<string>,
	place: Place,
): Promise<DirectPart[]> {
	const years = Array.from(
		{ length: HISTORY_YEARS.last - HISTORY_YEARS.first + 1 },
		(_, index) => HISTORY_YEARS.first + index,
	);
	const parts: DirectPart[] = [];
	for (const year of years)
		parts.push(
			await payStatisticsPart(
				String(year),
				read,
				place,
				historyFiles(place, year),
			),
		);
	parts.push(
		await payStatisticsPart("2025", read, place, currentFiles(place)),
	);
	return parts;
}
