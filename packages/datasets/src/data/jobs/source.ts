import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";

/**
 * Total jobs of each district in each year, as the ONS jobs density series
 * gives them on current district codes. One part per year.
 */
export async function jobsStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv<Record<string, string>>(
		await read(sourceDir("jobs", "total-jobs-lad-2011-2024.csv")),
		{ header: true },
	);

	const byYear = new Map<number, Map<string, DirectRecord>>();
	for (const row of data) {
		const code = row["GEOGRAPHY_CODE"]?.trim();
		const year = Number(row["DATE_NAME"]);
		const value = row["OBS_VALUE"]?.trim();
		if (!code || !Number.isFinite(year)) continue;
		// A missing figure is published as an empty value with status Q. It is
		// left out rather than read as no jobs: Northern Ireland has values for
		// only three of the fourteen years, and zero would claim the opposite.
		if (!value) continue;
		const totalJobs = Number(value);
		if (!Number.isFinite(totalJobs)) continue;

		const records = byYear.get(year) ?? new Map<string, DirectRecord>();
		records.set(code, {
			code,
			name: row["GEOGRAPHY_NAME"]?.trim() || "",
			values: [{ measure: "total-jobs", value: totalJobs }],
		});
		byYear.set(year, records);
	}

	return [...byYear.entries()]
		.sort(([left], [right]) => left - right)
		.map(([year, records]) => ({
			key: String(year),
			records: [...records.values()],
		}));
}
