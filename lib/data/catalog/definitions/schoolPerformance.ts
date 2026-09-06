import { loadSchoolPerformance } from "../../school-performance/loader";
import type { SchoolPerformanceDataset } from "@/lib/types/schoolPerformance";
import type { DatasetDefinition } from "../types";

export const schoolPerformanceDatasetDefinition: DatasetDefinition<SchoolPerformanceDataset> =
	{
		type: "schoolPerformance",
		precompiledFile: "school-performance",
		boundaryType: "localAuthority",
		source: {
			name: "School Performance (KS4)",
			source: "Department for Education",
			sourceUrl:
				"https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2024-25",
			year: "2024/25",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Key Stage 4 performance measures (GCSE results) by local authority district for England, with the 2018/19 to 2024/25 back series.",
		},
		precompile: ({ text }) => loadSchoolPerformance(text),
	};
