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

async function payRows(
	text: string,
	period: Period,
	place: Place,
): Promise<Map<string, PayRow>> {
	const skipLines = findHeaderLine(text, "Description");
	const { data } = await parseCsv(text, { header: true, skipLines });
	const rows = new Map<string, PayRow>();
	for (const row of data) {
		const code = row["Code"]?.trim();
		const description = row["Description"]?.trim();
		if (!code || !description || code === "Code" || !code.startsWith("E"))
			continue;
		// Metropolitan counties and Inner and Outer London are not atlas areas.
		if (code.startsWith("E11") || code.startsWith("E13")) continue;

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

/**
 * The Annual Survey of Hours and Earnings tables for one year: annual and
 * hourly gross pay of each authority, from the table of residence or workplace
 * earnings.
 */
export async function payStatisticsPart(
	read: (path: string) => Promise<string>,
	place: Place,
	files: { annual: string; hourly: string },
): Promise<DirectPart[]> {
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
	return [{ key: "2025", records: [...records.values()] }];
}

export const incomeFiles = {
	annual: sourceDir(
		"income",
		"table-8/PROV - Home Geography Table 8.7a   Annual pay - Gross 2025.xlsx",
	),
	hourly: sourceDir(
		"income",
		"table-8/PROV - Home Geography Table 8.5a   Hourly pay - Gross 2025.xlsx",
	),
};

export const workplaceIncomeFiles = {
	annual: sourceDir(
		"income",
		"table-7/PROV - Work Geography Table 7.7a   Annual pay - Gross 2025.xlsx",
	),
	hourly: sourceDir(
		"income",
		"table-7/PROV - Work Geography Table 7.5a   Hourly pay - Gross 2025.xlsx",
	),
};
