import { parseCsv } from "@/lib/helpers/parseCsv";
import type {
	PopulationConstituencyData,
	PopulationConstituencyDataset,
} from "@/lib/types/populationConstituency";

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
export async function loadPopulationConstituencyYear(
	year: number,
	sheetCsv: string,
): Promise<PopulationConstituencyDataset> {
	// Three preamble lines precede the header.
	const { data } = await parseCsv(sheetCsv, { header: true, skipLines: 3 });
	const records: Record<string, PopulationConstituencyData> = {};
	for (const row of data as Record<string, string>[]) {
		const constituencyCode = row["PCON 2025 Code"]?.trim() ?? "";
		if (!CONSTITUENCY_CODE.test(constituencyCode)) continue;
		const total = Number(row["Total"]);
		if (!Number.isInteger(total) || total <= 0)
			throw new Error(
				`Constituency population ${year}: unreadable total for ${constituencyCode}`,
			);
		records[constituencyCode] = {
			constituencyCode,
			constituencyName: row["PCON 2025 Name"]?.trim() ?? "",
			total,
		};
	}
	return {
		id: `populationConstituency${year}`,
		type: "populationConstituency",
		year,
		boundaryType: "constituency",
		boundaryYear: 2024,
		data: records,
	};
}
