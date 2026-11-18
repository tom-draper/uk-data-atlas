import type { OdsTableOptions } from "../spreadsheet/ods.ts";
import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";

const TABLE_NAME = "7_BHC_Relative_LA";
/** The financial years the table covers, by the year each ends. */
const YEARS = [2022, 2023, 2024, 2025] as const;

const TABLE_OPTIONS: OdsTableOptions = {
	table: TABLE_NAME,
	label: "child-poverty",
	maxColumns: 10,
};

/**
 * Children in relative low-income families before housing costs, as a count
 * and a rate, for each local authority. One part per year, named by the year
 * its financial year ends.
 */
export async function childPovertyStatisticsParts(
	readRows: (
		path: string,
		options: OdsTableOptions,
		visit: (row: readonly string[]) => void,
	) => Promise<void>,
): Promise<DirectPart[]> {
	const recordsByYear = new Map<number, DirectRecord[]>(
		YEARS.map((year) => [year, []]),
	);

	await readRows(
		sourceDir(
			"child-poverty",
			"children-in-low-income-families-2022-2025.ods",
		),
		TABLE_OPTIONS,
		(row) => {
			const [name, code, ...values] = row;
			if (!name || !code || !/^[EWSN]\d{8}$/.test(code)) return;

			for (const [index, year] of YEARS.entries()) {
				const count = Number(values[index]);
				const rate = Number(values[index + YEARS.length]) * 100;
				if (
					!Number.isFinite(count) ||
					!Number.isFinite(rate) ||
					rate <= 0
				)
					continue;
				recordsByYear.get(year)!.push({
					code,
					name,
					values: [
						{
							measure: "children-in-relative-low-income",
							value: count,
						},
						{
							measure: "children-in-relative-low-income-rate",
							value: rate,
						},
					],
				});
			}
		},
	);

	return YEARS.map((year) => ({
		key: String(year),
		records: recordsByYear.get(year)!,
	}));
}
