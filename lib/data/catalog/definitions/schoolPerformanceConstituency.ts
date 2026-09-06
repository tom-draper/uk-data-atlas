import { loadSchoolPerformanceConstituency } from "../../school-performance-constituency/loader";
import type { SchoolPerformanceConstituencyDataset } from "@/lib/types/schoolPerformance";
import type { DatasetDefinition } from "../types";

export const schoolPerformanceConstituencyDatasetDefinition: DatasetDefinition<SchoolPerformanceConstituencyDataset> =
	{
		type: "schoolPerformanceConstituency",
		precompiledFile: "school-performance-constituency",
		boundaryType: "constituency",
		source: {
			name: "School Performance (KS4, Constituency)",
			source: "Department for Education",
			sourceUrl:
				"https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2024-25",
			year: "2024/25",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Key Stage 4 performance measures (GCSE results) by Westminster parliamentary constituency for England, on 2024 review boundaries.",
			retrievedAt: "2026-09-06",
		},
		ingestion: {
			expectedBoundaryYears: [2024],
			requiredDataFields: ["pconCode", "pconName"],
		},
		precompile: ({ text }) => loadSchoolPerformanceConstituency(text),
	};
