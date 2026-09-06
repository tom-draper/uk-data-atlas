import {
	SchoolPerformanceDataset,
	SchoolPerformanceLADData,
	SchoolPerformanceMeasures,
} from "@/lib/types/schoolPerformance";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNullableNum } from "@/lib/helpers/parseNumber";

/**
 * "202425" is the 2024/25 academic year. The atlas keys these by the year the
 * academic year ends in, so 202425 becomes 2025.
 */
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

export async function loadSchoolPerformance(
	read: (path: string) => Promise<string>,
): Promise<Record<string, SchoolPerformanceDataset>> {
	const { data } = await parseCsv<Record<string, string>>(
		await read(
			"education/ks4-performance/202425_local_authority_district_revised.csv",
		),
		{ header: true },
	);

	// The file carries every year of the release, and each year appears under a
	// single version — 2023/24 as "Final", 2024/25 as "Revised" and so on — so
	// filtering on version would silently drop whole years rather than
	// deduplicate them.
	const byYear = new Map<number, Map<string, SchoolPerformanceLADData>>();

	for (const row of data as Record<string, string>[]) {
		if (row["geographic_level"] !== "Local authority district") continue;
		if (row["geography_basis"] !== "Pupil residency") continue;
		// Rows are repeated per disadvantage and free-school-meal split.
		if (row["breakdown_topic"] !== "Total") continue;

		const year = endYear((row["time_period"] ?? "").trim());
		if (year === null) continue;

		const code = (row["lad_code"] ?? "").trim();
		const name = (row["lad_name"] ?? "").trim();
		if (!code || !/^E[0-9]/.test(code)) continue;

		let yearRecords = byYear.get(year);
		if (!yearRecords) {
			yearRecords = new Map();
			byYear.set(year, yearRecords);
		}
		yearRecords.set(code, {
			ladCode: code,
			ladName: name,
			...readMeasures(row),
			series: {},
		});
	}

	const years = [...byYear.keys()].sort((a, b) => a - b);
	const latest = years[years.length - 1];
	if (latest === undefined) {
		throw new Error("KS4 performance data contained no usable rows");
	}

	// Headline figures come from the most recent year; every year the release
	// covers is kept alongside them so a district can be charted over time.
	const records: Record<string, SchoolPerformanceLADData> = {};
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
			id: `schoolPerformance${latest}`,
			type: "schoolPerformance",
			year: latest,
			boundaryType: "localAuthority",
			boundaryYear: 2024,
			data: records,
		},
	};
}
