export interface JobsLADData {
	ladCode: string;
	ladName: string;
	/**
	 * Jobs located in the district, rounded to the nearest thousand: employee
	 * jobs, self-employment jobs, government-supported trainees and HM Forces.
	 * Counted where the work is, not where the worker lives.
	 */
	totalJobs: number;
}

export interface JobsDataset {
	id: string;
	type: "jobs";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, JobsLADData>;
}
