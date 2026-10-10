import type { JobsDataset, JobsLADData } from "@/lib/types/jobs";
import type {
	PopulationLocalAuthorityData,
	PopulationUkDataset,
} from "@/lib/types/population";
import { parseCsv } from "@/lib/helpers/parseCsv";

/**
 * ONS restates the whole jobs density series on current district codes with
 * each release, so every year shares the April 2023 code vintage.
 */
const BOUNDARY_YEAR = 2023;

/** Jobs per 100k residents, using the population estimate for the same year. */
function addPopulationMetrics(
	records: Record<string, JobsLADData>,
	population: Record<string, PopulationLocalAuthorityData>,
) {
	for (const [code, record] of Object.entries(records)) {
		const total = Object.values(population[code]?.total ?? {}).reduce(
			(sum, value) => sum + value,
			0,
		);
		if (total > 0)
			record.metrics = {
				per100kPopulation: (record.totalJobs / total) * 100_000,
			};
	}
}

export async function loadJobs(
	read: (path: string) => Promise<string>,
	populationByYear: Record<string, PopulationUkDataset>,
): Promise<Record<string, JobsDataset>> {
	const { data } = await parseCsv(
		await read("economics/jobs/total-jobs-lad-2011-2024.csv"),
		{ header: true },
	);

	const recordsByYear = new Map<number, Record<string, JobsLADData>>();

	for (const row of data as Record<string, string>[]) {
		const ladCode = row["GEOGRAPHY_CODE"]?.trim();
		const year = Number(row["DATE_NAME"]);
		const value = row["OBS_VALUE"]?.trim();
		if (!ladCode || !Number.isFinite(year)) continue;
		// A missing figure is published as an empty value with status Q. It is
		// left out rather than read as no jobs: Northern Ireland has values for
		// only three of the fourteen years, and zero would claim the opposite.
		if (!value) continue;
		const totalJobs = Number(value);
		if (!Number.isFinite(totalJobs)) continue;

		const records = recordsByYear.get(year) ?? {};
		records[ladCode] = {
			ladCode,
			ladName: row["GEOGRAPHY_NAME"]?.trim() || "",
			totalJobs,
		};
		recordsByYear.set(year, records);
	}

	return Object.fromEntries(
		[...recordsByYear.entries()]
			.sort(([left], [right]) => left - right)
			.map(([year, records]) => {
				addPopulationMetrics(
					records,
					populationByYear[String(year)]?.data ?? {},
				);
				return [
					year,
					{
						id: `jobs${year}`,
						type: "jobs" as const,
						year,
						boundaryType: "localAuthority" as const,
						boundaryYear: BOUNDARY_YEAR,
						data: records,
					},
				];
			}),
	);
}
