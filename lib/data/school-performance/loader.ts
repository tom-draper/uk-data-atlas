import {
	SchoolPerformanceDataset,
	SchoolPerformanceLADData,
} from "@/lib/types/schoolPerformance";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { endYear, measureSeries, readMeasures } from "@/lib/data/education/ks4";

export async function loadSchoolPerformance(
	read: (path: string) => Promise<string>,
): Promise<Record<string, SchoolPerformanceDataset>> {
	const { data } = await parseCsv<Record<string, string>>(
		await read(
			"education/ks4-performance/local-authority-district/202425_local_authority_district_revised.csv",
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
		records[code] = {
			...record,
			series: measureSeries(byYear, years, code),
		};
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
