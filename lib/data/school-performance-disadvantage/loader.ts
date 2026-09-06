import {
	SchoolPerformanceGapData,
	SchoolPerformanceGapDataset,
	SchoolPerformanceGapMeasures,
} from "@/lib/types/schoolPerformance";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNullableNum } from "@/lib/helpers/parseNumber";

/**
 * Both groups must reach this many pupils before a gap is reported. The
 * release publishes cohorts as small as one pupil — the Isles of Scilly had a
 * single disadvantaged pupil in 2024/25, whose result alone would have shown
 * the district's disadvantaged pupils nineteen points ahead — so a floor is
 * needed to keep the map showing gaps rather than sampling noise.
 */
const MINIMUM_PUPILS = 6;

const DISADVANTAGED = "Disadvantaged";
const NOT_DISADVANTAGED = "Not known to be disadvantaged";

function endYear(timePeriod: string): number | null {
	const start = Number(timePeriod.slice(0, 4));
	return Number.isFinite(start) && start > 1900 ? start + 1 : null;
}

/** The difference, or null when either side is missing or too small to report. */
function difference(
	ahead: number | null,
	behind: number | null,
	aheadPupils: number | null,
	behindPupils: number | null,
): number | null {
	if (ahead === null || behind === null) return null;
	if (aheadPupils === null || behindPupils === null) return null;
	if (aheadPupils < MINIMUM_PUPILS || behindPupils < MINIMUM_PUPILS) {
		return null;
	}
	return Number((ahead - behind).toFixed(1));
}

interface Side {
	att8: number | null;
	engmath94: number | null;
	pupils: number | null;
	name: string;
}

function readSide(row: Record<string, string>): Side {
	return {
		att8: parseNullableNum(row["attainment8_average"]),
		engmath94: parseNullableNum(row["engmath_94_percent"]),
		pupils: parseNullableNum(row["pupil_count"]),
		name: (row["lad_name"] ?? "").trim(),
	};
}

function measures(
	disadvantaged: Side | undefined,
	notDisadvantaged: Side | undefined,
): SchoolPerformanceGapMeasures {
	const dis = disadvantaged ?? { att8: null, engmath94: null, pupils: null };
	const not = notDisadvantaged ?? {
		att8: null,
		engmath94: null,
		pupils: null,
	};
	return {
		att8Disadvantaged: dis.att8,
		att8NotDisadvantaged: not.att8,
		att8Gap: difference(not.att8, dis.att8, not.pupils, dis.pupils),
		engmath94Gap: difference(
			not.engmath94,
			dis.engmath94,
			not.pupils,
			dis.pupils,
		),
		disadvantagedPupils: dis.pupils,
		notDisadvantagedPupils: not.pupils,
	};
}

export async function loadSchoolPerformanceDisadvantage(
	read: (path: string) => Promise<string>,
): Promise<Record<string, SchoolPerformanceGapDataset>> {
	const { data } = await parseCsv<Record<string, string>>(
		await read(
			"education/ks4-performance/local-authority-district/202425_local_authority_district_revised.csv",
		),
		{ header: true },
	);

	// Two rows per district per year, one for each side of the split.
	const sides = new Map<number, Map<string, Record<string, Side>>>();

	for (const row of data as Record<string, string>[]) {
		if (row["geographic_level"] !== "Local authority district") continue;
		if (row["geography_basis"] !== "Pupil residency") continue;
		if (row["breakdown_topic"] !== "Disadvantage status") continue;

		const status = row["disadvantage_status"];
		if (status !== DISADVANTAGED && status !== NOT_DISADVANTAGED) continue;

		const year = endYear((row["time_period"] ?? "").trim());
		if (year === null) continue;

		const code = (row["lad_code"] ?? "").trim();
		if (!code || !/^E[0-9]/.test(code)) continue;

		let yearSides = sides.get(year);
		if (!yearSides) {
			yearSides = new Map();
			sides.set(year, yearSides);
		}
		const forCode = yearSides.get(code) ?? {};
		forCode[status] = readSide(row);
		yearSides.set(code, forCode);
	}

	const years = [...sides.keys()].sort((a, b) => a - b);
	const latest = years[years.length - 1];
	if (latest === undefined) {
		throw new Error("KS4 disadvantage data contained no usable rows");
	}

	const records: Record<string, SchoolPerformanceGapData> = {};
	for (const [code, forCode] of sides.get(latest)!) {
		const series: Record<number, SchoolPerformanceGapMeasures> = {};
		for (const year of years) {
			const yearForCode = sides.get(year)?.get(code);
			if (yearForCode) {
				series[year] = measures(
					yearForCode[DISADVANTAGED],
					yearForCode[NOT_DISADVANTAGED],
				);
			}
		}
		records[code] = {
			ladCode: code,
			ladName:
				forCode[NOT_DISADVANTAGED]?.name ??
				forCode[DISADVANTAGED]?.name ??
				"",
			...measures(forCode[DISADVANTAGED], forCode[NOT_DISADVANTAGED]),
			series,
		};
	}

	return {
		[latest]: {
			id: `schoolPerformanceGap${latest}`,
			type: "schoolPerformanceGap",
			year: latest,
			boundaryType: "localAuthority",
			boundaryYear: 2024,
			data: records,
		},
	};
}
