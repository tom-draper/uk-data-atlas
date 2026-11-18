import { parseCsv } from "../../helpers/parseCsv.ts";
import type { DirectPart } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";

/** The workbook's mid-years, each on the constituencies in force from July 2024. */
export const POPULATION_CONSTITUENCY_SHEETS = {
	2021: "Mid-2021 PCON 2025",
	2022: "Mid-2022 PCON 2025",
} as const;

const CONSTITUENCY_CODE = /^(E14|W07)\d{6}$/;

/**
 * Read one mid-year sheet's constituency totals, exactly as published.
 *
 * ONS labels these PCON 2025 because it adopted the codes in May 2025; they are
 * the constituencies first contested in July 2024.
 */
export async function populationConstituencyYear(
	year: number,
	sheetCsv: string,
): Promise<DirectPart> {
	// Three preamble lines precede the header.
	const { data } = await parseCsv(sheetCsv, { header: true, skipLines: 3 });
	const records: DirectPart["records"] = [];
	for (const row of data as Record<string, string>[]) {
		const code = row["PCON 2025 Code"]?.trim() ?? "";
		if (!CONSTITUENCY_CODE.test(code)) continue;
		const total = Number(row["Total"]);
		if (!Number.isInteger(total) || total <= 0)
			throw new Error(
				`Constituency population ${year}: unreadable total for ${code}`,
			);
		records.push({
			code,
			name: row["PCON 2025 Name"]?.trim() ?? "",
			values: [{ measure: "population", value: total }],
		});
	}
	return { key: String(year), records };
}

/** Both mid-years of the constituency population workbook. */
export async function populationConstituencyStatisticsParts(
	readSheet: (path: string, sheet: string) => Promise<string>,
): Promise<DirectPart[]> {
	const workbook = sourceDir(
		"population-constituency",
		"sapepconstablefinal.xlsx",
	);
	return Promise.all(
		Object.entries(POPULATION_CONSTITUENCY_SHEETS).map(
			async ([year, sheet]) =>
				populationConstituencyYear(
					Number(year),
					await readSheet(workbook, sheet),
				),
		),
	);
}
