import {
	SchoolPerformanceConstituencyData,
	SchoolPerformanceConstituencyDataset,
} from "@/lib/types/schoolPerformance";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { endYear, measureSeries, readMeasures } from "@/lib/data/education/ks4";

/**
 * The release spans 2018/19 onwards, but the constituencies were redrawn for
 * the 2024 review: everything before 2023/24 is the 533 pre-review seats, and
 * 2023/24 onwards is the 543 seats the atlas has boundaries for. Compiling
 * only the later vintage keeps one geography per dataset; joining the earlier
 * years would need the 2010-to-2024 crosswalk.
 */
const FIRST_2024_BOUNDARY_YEAR = 2024;

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
		records[code] = {
			...record,
			series: measureSeries(byYear, years, code),
		};
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
