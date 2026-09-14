import { loadJobs } from "../../jobs/loader";
import type { JobsDataset } from "@/lib/types/jobs";
import type { DatasetDefinition } from "../types";

export const jobsDatasetDefinition: DatasetDefinition<JobsDataset> = {
	type: "jobs",
	precompiledFile: "jobs",
	boundaryType: "localAuthority",
	// Published through the API first; the website has no chart for it yet.
	chartPending: true,
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	source: {
		name: "Jobs",
		source: "Office for National Statistics",
		sourceUrl: "https://www.nomisweb.co.uk/datasets/jd",
		year: "2011-2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Total jobs by local authority district, 2011 to 2024, on April 2023 codes: employee jobs, self-employment jobs, government-supported trainees and HM Forces, counted at the workplace and rounded to the nearest thousand. Great Britain is complete for every year; Northern Ireland is published for 2020 to 2022 only.",
	},
	ingestion: {
		minimumDatasets: 14,
		// Great Britain's 350 districts in every year; Northern Ireland adds
		// eleven only in 2020 to 2022.
		minimumDataRecords: 350,
		expectedBoundaryYears: [2023],
		requiredDataFields: ["totalJobs"],
	},
	precompile: ({ text }) => loadJobs(text),
};
