import type { AggregatedJobsData, JobsLADData } from "../../types/jobs.ts";

/** Jobs are workplace-based counts, so they add across local authorities. */
export const aggregateJobs = (
	records: JobsLADData[],
): AggregatedJobsData | null =>
	records.length === 0
		? null
		: {
				totalJobs: records.reduce(
					(total, record) => total + record.totalJobs,
					0,
				),
			};
