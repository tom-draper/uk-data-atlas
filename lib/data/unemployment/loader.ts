// Data source: ONS Model-based estimates of unemployment for local and unitary authorities
// https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/modelledunemploymentforlocalandunitaryauthoritiesm01/current
import { UnemploymentDataset, UnemploymentLADData } from "@/lib/types/unemployment";
import { parseCsv } from "@/lib/helpers/parseCsv";

// Parse a period label to a year integer, or null if not an annual period we want.
// Keeps: "1996/97" (-> 1996), "Jan 2004 to Dec 2004" (-> 2004).
// Discards quarterly periods like "Apr 2004 to Mar 2005".
function periodToYear(label: string): number | null {
	const fin = label.match(/^(\d{4})\/\d{2}/);
	if (fin) return parseInt(fin[1]);
	const cal = label.match(/^Jan (\d{4}) to Dec \d{4}/);
	if (cal) return parseInt(cal[1]);
	return null;
}

const toNum = (v: string): number | null => {
	const s = v.trim();
	if (!s || s === ":" || s === "..") return null;
	const n = parseFloat(s.replace(/,/g, ""));
	return isNaN(n) ? null : n;
};

export async function loadUnemployment(
	readSource: (path: string) => Promise<string>,
): Promise<Record<string, UnemploymentDataset>> {
	const csv = await readSource("economics/unemployment/modelbasedunemploymentdataapril2022rates.csv");

	const { data: rawRows } = await parseCsv<string[]>(csv, { header: false });
	const rows = rawRows as string[][];

	// Row index 2 (0-based): period headers
	const headerRow = rows[2] ?? [];

	// Build map: column index (0-based) -> year integer (annual periods only)
	const colToYear = new Map<number, number>();
	for (let i = 3; i < headerRow.length; i++) {
		const year = periodToYear(headerRow[i]?.trim() ?? "");
		if (year !== null) colToYear.set(i, year);
	}

	const years = Array.from(new Set(colToYear.values())).sort((a, b) => a - b);
	const latestYear = years[years.length - 1] ?? 2021;

	const records: Record<string, UnemploymentLADData> = {};

	// Data rows start at index 5; trailing blank rows have no LAD code
	for (let r = 5; r < rows.length; r++) {
		const row = rows[r];
		if (!row) continue;
		const name = row[0]?.trim() ?? "";
		const code = row[1]?.trim() ?? "";
		if (!code || !/^[EWSN]\d/.test(code)) continue;

		const rates: Record<number, number | null> = {};
		for (const [col, year] of colToYear) {
			rates[year] = toNum(row[col] ?? "");
		}

		records[code] = { ladCode: code, ladName: name, rates };
	}

	const dataset: UnemploymentDataset = {
		id: "unemployment",
		type: "unemployment",
		year: latestYear,
		boundaryType: "localAuthority",
		boundaryYear: 2024,
		years,
		latestYear,
		data: records,
	};

	return { [latestYear]: dataset };
}
