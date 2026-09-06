import { loadSchoolPerformanceDisadvantage } from "../../school-performance-disadvantage/loader";
import type { SchoolPerformanceGapDataset } from "@/lib/types/schoolPerformance";
import type { DatasetDefinition } from "../types";

export const schoolPerformanceDisadvantageDatasetDefinition: DatasetDefinition<SchoolPerformanceGapDataset> =
	{
		type: "schoolPerformanceGap",
		precompiledFile: "school-performance-disadvantage",
		boundaryType: "localAuthority",
		source: {
			name: "Attainment 8 Disadvantage Gap",
			source: "Department for Education",
			sourceUrl:
				"https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2024-25",
			year: "2024/25",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"How far non-disadvantaged pupils are ahead of disadvantaged pupils at Key Stage 4, by local authority district for England. Derived from the published disadvantage breakdown as a plain difference in Attainment 8, not the Department's rank-based disadvantage gap index.",
			retrievedAt: "2026-09-06",
		},
		ingestion: {
			expectedBoundaryYears: [2024],
			requiredDataFields: ["ladCode", "ladName"],
		},
		precompile: ({ text }) => loadSchoolPerformanceDisadvantage(text),
	};
