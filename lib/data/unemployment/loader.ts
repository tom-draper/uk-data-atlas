// Data source: ONS Model-based estimates of unemployment for local and unitary authorities
// https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/modelledunemploymentforlocalandunitaryauthoritiesm01/current
import {
	UnemploymentDataset,
	UnemploymentLADData,
} from "@/lib/types/unemployment";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations";

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

/**
 * A rate, to the one decimal place the workbook publishes. It stores the
 * modelled value at full precision — 3.55097048 for a published 3.6 — and the
 * confidence interval in the column beside it is around two percentage points
 * wide, so carrying those digits would assert a precision the estimate does
 * not have.
 */
const toNum = (v: string): number | null => {
	const s = v.trim();
	if (!s || s === ":" || s === "..") return null;
	const n = parseFloat(s.replace(/,/g, ""));
	return isNaN(n) ? null : Number(n.toFixed(1));
};

// Scotland reassigned these unchanged council areas new statistical codes
// between the historical unemployment release and the 2024 map boundaries.
// The dataset is always rendered on current boundaries, so key it accordingly.
const SCOTTISH_LAD_CODE_REPLACEMENTS: Record<string, string> = {
	S12000015: "S12000047", // Fife
	S12000024: "S12000048", // Perth and Kinross
	S12000046: "S12000049", // Glasgow City
	S12000044: "S12000050", // North Lanarkshire
};

export function normaliseUnemploymentBoundaryCodes(
	records: Record<string, UnemploymentLADData>,
): void {
	for (const [legacyCode, currentCode] of Object.entries(
		SCOTTISH_LAD_CODE_REPLACEMENTS,
	)) {
		const record = records[legacyCode];
		if (!record || records[currentCode]) continue;
		records[currentCode] = { ...record, ladCode: currentCode };
		delete records[legacyCode];
	}
}

/** Add post-2023 authority records from the predecessor rate estimates. */
export function addMergedUnemploymentAuthorities(
	records: Record<string, UnemploymentLADData>,
	years: readonly number[],
): void {
	for (const [target, { name, predecessors }] of Object.entries(
		APRIL_2023_LAD_MERGERS,
	)) {
		if (records[target]) continue;
		const source = predecessors.map((code) => {
			const record = records[code];
			if (!record)
				throw new Error(
					`Missing unemployment predecessor ${code} for ${target}`,
				);
			return record;
		});
		const rates = Object.fromEntries(
			years.map((year) => {
				const values = source
					.map((record) => record.rates[year])
					.filter((rate): rate is number => rate !== null);
				// The workbook publishes rates, not the denominators needed for a
				// new weighted estimate. Match the chart's existing area aggregation.
				return [
					year,
					values.length > 0
						? values.reduce((sum, rate) => sum + rate, 0) /
							values.length
						: null,
				];
			}),
		) as Record<number, number | null>;
		records[target] = { ladCode: target, ladName: name, rates };
	}
}

export async function loadUnemployment(
	readSource: (path: string) => Promise<string>,
): Promise<Record<string, UnemploymentDataset>> {
	const csv = await readSource(
		"economics/unemployment/model-based/modelbasedunemploymentdataaugust2022.xls",
	);

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
	normaliseUnemploymentBoundaryCodes(records);
	addMergedUnemploymentAuthorities(records, years);

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
