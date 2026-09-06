import {
	SchoolPerformanceConstituencyData,
	SchoolPerformanceConstituencyDataset,
	SchoolPerformanceMeasures,
} from "@/lib/types/schoolPerformance";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNullableNum } from "@/lib/helpers/parseNumber";

/**
 * The release spans 2018/19 onwards, but the constituencies were redrawn for
 * the 2024 review: everything before 2023/24 is the 533 pre-review seats, and
 * 2023/24 onwards is the 543 seats the atlas has boundaries for. Compiling
 * only the later vintage keeps one geography per dataset; joining the earlier
 * years would need the 2010-to-2024 crosswalk.
 */
const FIRST_2024_BOUNDARY_YEAR = 2024;

function endYear(timePeriod: string): number | null {
	const start = Number(timePeriod.slice(0, 4));
	return Number.isFinite(start) && start > 1900 ? start + 1 : null;
}

function readMeasures(row: Record<string, string>): SchoolPerformanceMeasures {
	return {
		ptL2basics94: parseNullableNum(row["engmath_94_percent"]),
		ptL2basics95: parseNullableNum(row["engmath_95_percent"]),
		avgAtt8: parseNullableNum(row["attainment8_average"]),
		avgP8score: parseNullableNum(row["progress8_average"]),
		pupils: parseNullableNum(row["pupil_count"]),
	};
}

export async function loadSchoolPerformanceConstituency(
	read: (path: string) => Promise<string>,
): Promise<Record<string, SchoolPerformanceConstituencyDataset>> {
	const { data } = await parseCsv<Record<string, string>>(
		await read(
			"education/ks4-performance/constituency/202425_parliamentary_constituency_revised.csv",
		),
		{ header: true },
	);

	const byYear = new Map<
		number,
		Map<string, SchoolPerformanceConstituencyData>
	>();

	for (const row of data as Record<string, string>[]) {
		if (row["geographic_level"] !== "Parliamentary constituency") continue;
		if (row["geography_basis"] !== "Pupil residency") continue;

		const year = endYear((row["time_period"] ?? "").trim());
		if (year === null || year < FIRST_2024_BOUNDARY_YEAR) continue;

		const code = (row["pcon_code"] ?? "").trim();
		const name = (row["pcon_name"] ?? "").trim();
		if (!code || !/^E14/.test(code)) continue;

		let yearRecords = byYear.get(year);
		if (!yearRecords) {
			yearRecords = new Map();
			byYear.set(year, yearRecords);
		}
		yearRecords.set(code, {
			pconCode: code,
			pconName: name,
			...readMeasures(row),
			series: {},
		});
	}

	const years = [...byYear.keys()].sort((a, b) => a - b);
	const latest = years[years.length - 1];
	if (latest === undefined) {
		throw new Error(
			"KS4 constituency data contained no rows on 2024 boundaries",
		);
	}

	const records: Record<string, SchoolPerformanceConstituencyData> = {};
	for (const [code, record] of byYear.get(latest)!) {
		const series: Record<number, SchoolPerformanceMeasures> = {};
		for (const year of years) {
			const forYear = byYear.get(year)?.get(code);
			if (forYear) {
				series[year] = {
					ptL2basics94: forYear.ptL2basics94,
					ptL2basics95: forYear.ptL2basics95,
					avgAtt8: forYear.avgAtt8,
					avgP8score: forYear.avgP8score,
					pupils: forYear.pupils,
				};
			}
		}
		records[code] = { ...record, series };
	}

	return {
		[latest]: {
			id: `schoolPerformanceConstituency${latest}`,
			type: "schoolPerformanceConstituency",
			year: latest,
			boundaryType: "constituency",
			boundaryYear: 2024,
			data: records,
		},
	};
}
