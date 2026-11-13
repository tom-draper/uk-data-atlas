import type { SchoolPerformanceConstituencyDataset } from "../../../types/schoolPerformance.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import {
	SCHOOL_MEASURES,
	SCHOOL_COPIES,
	schoolYear,
	schoolFields,
	schoolYears,
	latestCopies,
	latestCopyRules,
} from "../../../data/school-performance-constituency/statistics.ts";
import { loadSchoolPerformanceConstituency } from "../../../data/school-performance-constituency/loader.ts";

export const schoolPerformanceConstituency =
	defineDataset<SchoolPerformanceConstituencyDataset>({
		id: "school-performance-constituency",
		topic: "schools",
		boundary: { type: "constituency", year: 2024 },
		chartPending: true,
		coverageCountries: ["GB-ENG"],
		source: {
			name: "School Performance (KS4, Constituency)",
			publisher: "Department for Education",
			sourceUrl:
				"https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2024-25",
			year: "2024/25",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			attribution:
				"Department for Education. Contains public sector information licensed under the Open Government Licence v3.0.",
			description:
				"Key Stage 4 performance measures (GCSE results) by Westminster parliamentary constituency for England, on 2024 review boundaries.",
			retrievedAt: "2026-09-06",
			cadence: "annual",
			notes: [],
		},
		ingestion: {
			expectedBoundaryYears: [2024],
			requiredDataFields: ["pconCode", "pconName"],
		},
		load: ({ text }) => loadSchoolPerformanceConstituency(text),
		statistics: {
			payload: {
				parts: yearParts(
					"school-performance-constituency",
					"constituency",
					2024,
					{ coverageCountries: ["GB-ENG"] },
					["2025"],
				),
				code: "pconCode",
				periodKeys: schoolYears,
				sparsePeriods: true,
				nullPaths: ["avgP8score", "series.2025.avgP8score"],
			},
			name: "pconName",
			period: schoolYear,
			measures: SCHOOL_MEASURES,
			fields: schoolFields("series.{period}."),
			derived: latestCopies(SCHOOL_COPIES),
			computed: latestCopyRules(SCHOOL_COPIES),
		},
	});
