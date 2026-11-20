import { parseCsv } from "../../helpers/parseCsv.ts";
import type { DirectPart, DirectValue } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";

/** The workbook's mid-years, each on the constituencies in force from July 2024. */
export const POPULATION_CONSTITUENCY_SHEETS = {
	2021: "Mid-2021 PCON 2025",
	2022: "Mid-2022 PCON 2025",
} as const;

const CONSTITUENCY_CODE = /^(E14|W07)\d{6}$/;

const AGES = Array.from({ length: 91 }, (_, age) => age);

/**
 * Read one mid-year sheet's constituency totals and single years of age by
 * sex, exactly as published. A figure for everyone of an age is the sum of the
 * published females and males, which the sheet does not give.
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
		const values: DirectValue[] = [{ measure: "population", value: total }];
		for (const age of AGES) {
			const female = ageCount(row, `F${age}`, code, year);
			const male = ageCount(row, `M${age}`, code, year);
			for (const [sex, value] of [
				["all", female + male],
				["male", male],
				["female", female],
			] as const)
				values.push({
					measure: "population",
					members: { sex, age: String(age) },
					value,
				});
		}
		records.push({
			code,
			name: row["PCON 2025 Name"]?.trim() ?? "",
			values,
		});
	}
	return { key: String(year), records };
}

/** What a sheet publishes for one sex at one age, which must be a count. */
const ageCount = (
	row: Record<string, string>,
	column: string,
	code: string,
	year: number,
): number => {
	const text = row[column]?.trim() ?? "";
	const count = Number(text);
	if (text === "" || !Number.isInteger(count) || count < 0)
		throw new Error(
			`Constituency population ${year}: unreadable ${column} for ${code}`,
		);
	return count;
};

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
