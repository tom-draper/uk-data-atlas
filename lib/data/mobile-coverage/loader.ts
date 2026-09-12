import type {
	MobileCoverageDataset,
	MobileCoverageLADData,
} from "@/lib/types/mobileCoverage";
import { parseCsv } from "@/lib/helpers/parseCsv";

const YEAR = 2025;
const BOUNDARY_YEAR = 2024;

/**
 * Every `<technology>_<measure>_<n>` column is the percentage of premises, or
 * of landmass, reached by exactly `n` of the four operators, and the five
 * columns of a family sum to 100. An empty cell is a zero the publisher left
 * blank rather than missing data, so it reads as 0 and only a missing column
 * reads as null.
 */
const share = (row: Record<string, string>, column: string): number | null => {
	if (!(column in row)) return null;
	const value = (row[column] ?? "").trim();
	if (value === "" || value === "N/A" || value === "-") return 0;
	const parsed = parseFloat(value.replace(/,/g, "").replace(/%/, ""));
	return Number.isFinite(parsed) ? parsed : null;
};

/**
 * The share reached by at least one operator is everything but the zero bucket.
 * Rounded because subtracting from 100 otherwise leaves a binary-floating-point
 * tail, and the publisher quotes two decimals.
 */
const atLeastOne = (
	row: Record<string, string>,
	family: string,
): number | null => {
	const none = share(row, `${family}_0`);
	return none === null ? null : Math.round((100 - none) * 100) / 100;
};

const count = (row: Record<string, string>, column: string): number | null => {
	const parsed = parseFloat((row[column] ?? "").replace(/,/g, "").trim());
	return Number.isFinite(parsed) ? parsed : null;
};

export async function loadMobileCoverage(
	read: (path: string) => Promise<string>,
): Promise<Record<string, MobileCoverageDataset>> {
	const { data } = await parseCsv<Record<string, string>>(
		await read("telecoms/mobile/202507_mobile_coverage_laua_r01.csv"),
		{ header: true },
	);

	const records: Record<string, MobileCoverageLADData> = {};
	for (const row of data as Record<string, string>[]) {
		const ladCode = (row["laua"] ?? "").trim();
		const ladName = (row["laua_name"] ?? "").trim();
		if (!ladCode || !ladName || !/^[EWSN][0-9]/.test(ladCode)) continue;

		records[ladCode] = {
			ladCode,
			ladName,
			pct4GIndoorAll: share(row, "4G_prem_in_4"),
			pct4GIndoorAny: atLeastOne(row, "4G_prem_in"),
			pct5GOutdoorAll: share(row, "5G_high_confidence_prem_out_4"),
			pct5GOutdoorAny: atLeastOne(row, "5G_high_confidence_prem_out"),
			pct4GGeoAll: share(row, "4G_geo_out_4"),
			pct5GGeoAny: atLeastOne(row, "5G_high_confidence_geo_out"),
			premisesCount: count(row, "prem_count"),
		};
	}

	return {
		[YEAR]: {
			id: `mobileCoverage${YEAR}`,
			type: "mobileCoverage",
			year: YEAR,
			boundaryType: "localAuthority",
			boundaryYear: BOUNDARY_YEAR,
			data: records,
		},
	};
}
