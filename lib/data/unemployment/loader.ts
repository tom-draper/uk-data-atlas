// Data source: ONS Model-based estimates of unemployment for local and unitary authorities
// https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/modelledunemploymentforlocalandunitaryauthoritiesm01/current
import {
	UnemploymentDataset,
	UnemploymentLADData,
} from "@/lib/types/unemployment";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations";

const WORKBOOK =
	"economics/unemployment/model-based/modelbasedunemploymentdataaugust2022.xls";

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/**
 * An annual period label as a year key and what it stands for, or null for
 * the rolling quarterly periods the workbook also publishes.
 * Keeps: "1996/97" (-> 1996, April 1996 to March 1997), "Jan 2004 to Dec
 * 2004" (-> 2004). Discards overlapping periods like "Apr 2004 to Mar 2005".
 */
export function annualPeriod(
	label: string,
): { year: number; label: string } | null {
	const fin = label.match(/^(\d{4})\/\d{2}/);
	if (fin) {
		const year = parseInt(fin[1]);
		return { year, label: `April ${year} to March ${year + 1}` };
	}
	const cal = label.match(/^Jan (\d{4}) to Dec \d{4}/);
	if (cal) {
		const year = parseInt(cal[1]);
		return { year, label: `${MONTHS[0]} to ${MONTHS[11]} ${year}` };
	}
	return null;
}

/** A published figure, or null where the workbook marks it unavailable. */
const parseValue = (v: string | undefined): number | null => {
	const s = (v ?? "").trim();
	if (!s || s === ":" || s === "..") return null;
	const n = parseFloat(s.replace(/,/g, ""));
	return isNaN(n) ? null : n;
};

/**
 * A figure to the one decimal place the workbook publishes. It stores the
 * modelled value at full precision — 3.55097048 for a published 3.6 — and the
 * confidence interval beside it is around two percentage points wide, so
 * carrying those digits would assert a precision the estimate does not have.
 */
const oneDecimal = (n: number | null) =>
	n === null ? null : Number(n.toFixed(1));

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

/**
 * Add post-2023 authority records from their predecessors' estimates.
 *
 * A rate is unemployed people over economically active people, so a combined
 * rate weighs each predecessor by its economically active residents, which
 * the workbook gives as its level over its rate. A flat mean would count a
 * district of 20,000 active residents the same as one of 200,000. A year with
 * any predecessor unestimated has no combined value.
 */
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
		const rates: Record<number, number | null> = {};
		const levels: Record<number, number | null> = {};
		for (const year of years) {
			const parts = source.map((record) => ({
				level: record.levels?.[year] ?? null,
				rate: record.rates[year],
			}));
			if (
				parts.some(
					({ level, rate }) =>
						level === null || rate === null || rate <= 0,
				)
			) {
				rates[year] = null;
				levels[year] = null;
				continue;
			}
			const unemployed = parts.reduce(
				(sum, { level }) => sum + level!,
				0,
			);
			const active = parts.reduce(
				(sum, { level, rate }) => sum + (level! / rate!) * 100,
				0,
			);
			rates[year] = oneDecimal((unemployed / active) * 100);
			levels[year] = unemployed;
		}
		records[target] = {
			ladCode: target,
			ladName: name,
			rates,
			levels,
			derivedFromPredecessors: [...predecessors],
		};
	}
}

type Sheet = {
	years: number[];
	periodLabels: Record<number, string>;
	rows: Array<{
		code: string;
		name: string;
		values: Record<number, number | null>;
		intervals: Record<number, number | null>;
	}>;
};

/** One of the workbook's local authority sheets: values with their intervals. */
async function readSheet(csv: string): Promise<Sheet> {
	const { data: rawRows } = await parseCsv<string[]>(csv, { header: false });
	const rows = rawRows as string[][];
	// Row index 2 (0-based) holds the period headers; each period's value is
	// under its header and its confidence interval in the next column.
	const headerRow = rows[2] ?? [];
	const columns = new Map<number, number>();
	const periodLabels: Record<number, string> = {};
	for (let i = 3; i < headerRow.length; i++) {
		const period = annualPeriod(headerRow[i]?.trim() ?? "");
		if (!period) continue;
		columns.set(i, period.year);
		periodLabels[period.year] = period.label;
	}
	const parsed: Sheet["rows"] = [];
	// Data rows start at index 5; trailing blank rows have no LAD code
	for (let r = 5; r < rows.length; r++) {
		const row = rows[r];
		if (!row) continue;
		const code = row[1]?.trim() ?? "";
		if (!code || !/^[EWSN]\d/.test(code)) continue;
		const values: Record<number, number | null> = {};
		const intervals: Record<number, number | null> = {};
		for (const [col, year] of columns) {
			values[year] = parseValue(row[col]);
			intervals[year] = parseValue(row[col + 1]);
		}
		parsed.push({ code, name: row[0]?.trim() ?? "", values, intervals });
	}
	return {
		years: [...new Set(columns.values())].sort((a, b) => a - b),
		periodLabels,
		rows: parsed,
	};
}

export async function loadUnemployment(
	readSheetCsv: (path: string, sheet: string) => Promise<string>,
): Promise<Record<string, UnemploymentDataset>> {
	const rateSheet = await readSheet(
		await readSheetCsv(WORKBOOK, "LA,UA Rates"),
	);
	const levelSheet = await readSheet(
		await readSheetCsv(WORKBOOK, "LA,UA Levels"),
	);
	if (rateSheet.years.join() !== levelSheet.years.join())
		throw new Error(
			"Unemployment rate and level sheets cover different years",
		);
	const levelsByCode = new Map(levelSheet.rows.map((row) => [row.code, row]));

	const { years, periodLabels } = rateSheet;
	const latestYear = years[years.length - 1] ?? 2021;

	const records: Record<string, UnemploymentLADData> = {};
	for (const row of rateSheet.rows) {
		const level = levelsByCode.get(row.code);
		if (!level)
			throw new Error(`Unemployment levels have no row for ${row.code}`);
		const rounded = (values: Record<number, number | null>) =>
			Object.fromEntries(
				years.map((year) => [year, oneDecimal(values[year] ?? null)]),
			) as Record<number, number | null>;
		records[row.code] = {
			ladCode: row.code,
			ladName: row.name,
			rates: rounded(row.values),
			rateIntervals: rounded(row.intervals),
			levels: level.values,
			levelIntervals: level.intervals,
		};
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
		periodLabels,
		latestYear,
		data: records,
	};

	return { [latestYear]: dataset };
}
