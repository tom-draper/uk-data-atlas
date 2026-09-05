import { parseCsv } from "@/lib/helpers/parseCsv";
import type {
	AgeData,
	PopulationLocalAuthorityData,
	PopulationUkDataset,
} from "@/lib/types";

/** Local authority codes in the MYEB1 sheet, e.g. E06000001. */
const LA_CODE = /^[ENSW]\d{8}$/;

const emptyRecord = (
	ladName: string,
	country: string,
): PopulationLocalAuthorityData => ({
	total: {},
	males: {},
	females: {},
	ladName,
	country,
});

/**
 * Reads the MYEB1 back series: one row per local authority, sex and single
 * year of age, with a population column for every mid-year it covers. One
 * dataset is emitted per year.
 *
 * The sheet ends in footnote rows and carries a title above its header, so a
 * row is used only when it names a real local authority, sex and age.
 */
export async function loadPopulationUk(
	readSheet: (path: string, sheet: string) => Promise<string>,
): Promise<Record<string, PopulationUkDataset>> {
	const { data } = await parseCsv<string[]>(
		await readSheet(
			"demographics/population/uk/myebtablesuk20112024.xlsx",
			"MYEB1",
		),
		{ header: false, skipLines: 1 },
	);
	const rows = data as string[][];
	if (rows.length === 0) return {};

	const headerRow = rows[0];
	const yearCols: Array<{ index: number; year: number }> = [];
	for (let i = 0; i < headerRow.length; i++) {
		const match = /^population_(\d{4})$/.exec(headerRow[i]?.trim() ?? "");
		if (match) yearCols.push({ index: i, year: Number(match[1]) });
	}

	const byYear = new Map<
		number,
		Record<string, PopulationLocalAuthorityData>
	>(yearCols.map(({ year }) => [year, {}]));

	for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
		const row = rows[rowIdx];
		if (!Array.isArray(row) || row.length < 6) continue;

		const ladCode = row[0]?.trim() ?? "";
		if (!LA_CODE.test(ladCode)) continue;
		const sex = row[3]?.trim().toLowerCase();
		if (sex !== "f" && sex !== "m") continue;
		const age = row[4]?.trim() ?? "";
		if (!/^\d+$/.test(age)) continue;

		const ladName = row[1]?.trim() || "";
		const country = row[2]?.trim() || "";

		for (const { index, year } of yearCols) {
			const value = row[index]?.trim();
			if (!value) continue;
			const count = parseInt(value.replace(/,/g, ""), 10);
			if (isNaN(count)) continue;

			const yearData = byYear.get(year);
			if (!yearData) continue;
			const record = (yearData[ladCode] ??= emptyRecord(
				ladName,
				country,
			));
			const bySex: AgeData = sex === "f" ? record.females : record.males;
			bySex[age] = (bySex[age] || 0) + count;
			record.total[age] = (record.total[age] || 0) + count;
		}
	}

	const datasets: Record<string, PopulationUkDataset> = {};
	for (const [year, yearData] of byYear) {
		if (Object.keys(yearData).length === 0) continue;
		datasets[year] = {
			id: `populationUk${year}`,
			type: "populationUk",
			year,
			// MYEB1 is published on the April 2023 local authority boundaries.
			boundaryYear: 2023,
			boundaryType: "localAuthority",
			data: yearData,
		};
	}
	return datasets;
}
