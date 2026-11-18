import type {
	DirectPart,
	DirectRecord,
	DirectValue,
} from "../../declaration/statistics.ts";
import type { SchoolPerformanceMeasures } from "../../types/schoolPerformance.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { endYear, readMeasures } from "../education/ks4.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { schoolYear } from "./statistics.ts";

/**
 * The release spans 2018/19 onwards, but the constituencies were redrawn for
 * the 2024 review: everything before 2023/24 is the 533 pre-review seats, and
 * 2023/24 onwards is the 543 seats the atlas has boundaries for. Reading only
 * the later vintage keeps one geography per part; joining the earlier years
 * would need the 2010-to-2024 crosswalk.
 */
const FIRST_2024_BOUNDARY_YEAR = 2024;

const MEASURE_FIELDS = [
	["ptL2basics94", "gcse-english-maths-grade-4"],
	["ptL2basics95", "gcse-english-maths-grade-5"],
	["avgAtt8", "attainment-8"],
	["avgP8score", "progress-8"],
	["pupils", "key-stage-4-pupils"],
] as const;

/** One year's measures, in the period of the academic year they end. */
export const schoolMeasureValues = (
	year: number,
	measures: SchoolPerformanceMeasures,
): DirectValue[] =>
	MEASURE_FIELDS.map(([field, measure]) => ({
		measure,
		value: measures[field],
		period: schoolYear(String(year)),
	}));

type Row = { code: string; name: string; measures: SchoolPerformanceMeasures };

/**
 * The records of the latest year, each with every year the release holds for
 * its area, so an area can be charted over time.
 */
function latestWithSeries(
	byYear: ReadonlyMap<number, ReadonlyMap<string, Row>>,
	what: string,
): DirectRecord[] {
	const years = [...byYear.keys()].sort((a, b) => a - b);
	const latest = years[years.length - 1];
	if (latest === undefined)
		throw new Error(`${what} contained no usable rows`);
	return [...byYear.get(latest)!.values()].map(({ code, name }) => ({
		code,
		name,
		values: years.flatMap((year) => {
			const row = byYear.get(year)?.get(code);
			return row ? schoolMeasureValues(year, row.measures) : [];
		}),
	}));
}

/**
 * Key stage 4 performance by local authority district, as the part of the
 * latest year, and by Westminster constituency on 2024 boundaries as the same
 * year prefixed `constituency-`. Each area carries every year of the release.
 *
 * The file carries every year, each under a single version, 2023/24 as
 * "Final", 2024/25 as "Revised" and so on, so filtering on version would
 * silently drop whole years rather than deduplicate them.
 */
export async function schoolPerformanceStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data: districts } = await parseCsv<Record<string, string>>(
		await read(
			sourceDir(
				"school-performance",
				"202425_local_authority_district_revised.csv",
			),
		),
		{ header: true },
	);
	const byDistrictYear = new Map<number, Map<string, Row>>();
	for (const row of districts as Record<string, string>[]) {
		if (row["geographic_level"] !== "Local authority district") continue;
		if (row["geography_basis"] !== "Pupil residency") continue;
		// Rows are repeated per disadvantage and free-school-meal split.
		if (row["breakdown_topic"] !== "Total") continue;

		const year = endYear((row["time_period"] ?? "").trim());
		if (year === null) continue;
		const code = (row["lad_code"] ?? "").trim();
		// Joint districts ("E07000010 / E07000009") have no boundary.
		if (!/^E\d{8}$/.test(code)) continue;

		const yearRows = byDistrictYear.get(year) ?? new Map<string, Row>();
		yearRows.set(code, {
			code,
			name: (row["lad_name"] ?? "").trim(),
			measures: readMeasures(row),
		});
		byDistrictYear.set(year, yearRows);
	}
	const districtYears = [...byDistrictYear.keys()];
	const latestDistrictYear = Math.max(...districtYears);

	const { data: constituencies } = await parseCsv<Record<string, string>>(
		await read(
			sourceDir(
				"school-performance-constituency",
				"202425_parliamentary_constituency_revised.csv",
			),
		),
		{ header: true },
	);
	const byConstituencyYear = new Map<number, Map<string, Row>>();
	for (const row of constituencies as Record<string, string>[]) {
		if (row["geographic_level"] !== "Parliamentary constituency") continue;
		if (row["geography_basis"] !== "Pupil residency") continue;

		const year = endYear((row["time_period"] ?? "").trim());
		if (year === null || year < FIRST_2024_BOUNDARY_YEAR) continue;
		const code = (row["pcon_code"] ?? "").trim();
		if (!code || !/^E14/.test(code)) continue;

		const yearRows = byConstituencyYear.get(year) ?? new Map<string, Row>();
		yearRows.set(code, {
			code,
			name: (row["pcon_name"] ?? "").trim(),
			measures: readMeasures(row),
		});
		byConstituencyYear.set(year, yearRows);
	}
	const latestConstituencyYear = Math.max(...byConstituencyYear.keys());

	return [
		{
			key: String(latestDistrictYear),
			records: latestWithSeries(byDistrictYear, "KS4 performance data"),
		},
		{
			key: `constituency-${latestConstituencyYear}`,
			records: latestWithSeries(
				byConstituencyYear,
				"KS4 constituency data on 2024 boundaries",
			),
		},
	];
}
