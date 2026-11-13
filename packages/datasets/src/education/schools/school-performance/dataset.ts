import { loadSchoolPerformanceConstituency } from "../../../data/school-performance/constituencyLoader.ts";
import type { SchoolPerformanceDataset } from "../../../types/schoolPerformance.ts";
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
} from "../../../data/school-performance/statistics.ts";
import { aggregateSchoolPerformance } from "../../../data/school-performance/aggregate.ts";
import { loadSchoolPerformance } from "../../../data/school-performance/loader.ts";

const LA_NULLS = [
	"avgP8score",
	"series.2020.avgP8score",
	"series.2021.avgP8score",
	"series.2025.avgP8score",
];
const CONSTITUENCY_NULLS = ["avgP8score", "series.2025.avgP8score"];

/** A part of the file is on constituencies when its key says so. */
const onConstituencies = (header: { boundaryType?: unknown }) =>
	header.boundaryType === "constituency";

export const schoolPerformance = defineDataset<SchoolPerformanceDataset>({
	id: "school-performance",
	topic: "schools",
	boundary: { type: "localAuthority", year: 2024 },
	coverageCountries: ["GB-ENG"],
	source: {
		name: "School Performance (KS4)",
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
			"Key Stage 4 performance measures (GCSE results) for England by local authority district, with the 2018/19 to 2024/25 back series, and by Westminster parliamentary constituency on 2024 review boundaries for 2023/24 onwards.",
		cadence: "annual",
		notes: [],
	},
	additionalBoundaryTypes: ["constituency"],
	ingestion: { minimumDatasets: 2 },
	load: async ({ text }) => ({
		...(await loadSchoolPerformance(text)),
		// The charts read only the primary local authority parts, so the
		// constituency parts are typed as the dataset's shape here.
		...((await loadSchoolPerformanceConstituency(
			text,
		)) as unknown as Record<string, SchoolPerformanceDataset>),
	}),
	statistics: {
		payload: {
			parts: (labels) => [
				...yearParts(
					"school-performance",
					"localAuthority",
					2024,
					{ coverageCountries: ["GB-ENG"] },
					["2025"],
				)(labels),
				...yearParts(
					"school-performance",
					"constituency",
					2024,
					{ coverageCountries: ["GB-ENG"] },
					["2025"],
				)(labels).map(({ key, header }) => ({
					key: `constituency-${key}`,
					header: {
						...header,
						id: `school-performance-constituency${key}`,
					},
				})),
			],
			partPerGeography: true,
			code: (header) =>
				onConstituencies(header) ? "pconCode" : "ladCode",
			periodKeys: schoolYears,
			sparsePeriods: true,
			nullPaths: (header) =>
				onConstituencies(header) ? CONSTITUENCY_NULLS : LA_NULLS,
		},
		name: (header) => (onConstituencies(header) ? "pconName" : "ladName"),
		period: (key) => schoolYear(key.slice(key.lastIndexOf("-") + 1)),
		alsoIn: (header) =>
			onConstituencies(header)
				? []
				: [
						{ geography: "localAuthority", year: 2022 },
						{ geography: "localAuthority", year: 2018 },
					],
		measures: SCHOOL_MEASURES,
		fields: schoolFields("series.{period}."),
		derived: latestCopies(SCHOOL_COPIES),
		computed: latestCopyRules(SCHOOL_COPIES),
	},
	display: {
		label: "GCSE Performance [2024/25]",
		year: 2025,
		card: {
			heading: "GCSE Performance",
			period: "2024/25",
			coverage: "England",
			source: "Department for Education. Key Stage 4 Performance 2024/25. explore-education-statistics.service.gov.uk",
		},
		measures: [
			{
				id: "grade4",
				label: "Grade 4+",
				field: "ptL2basics94",
				colorRange: { min: 50, max: 80 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% grade 4+",
					},
				},
				card: {
					unit: "% grade 4+",
					digits: 1,
					maximum: 100,
					secondary: {
						field: "ptL2basics95",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: "% grade 5+",
						},
					},
				},
			},
			{
				id: "grade5",
				label: "Grade 5+",
				field: "ptL2basics95",
				colorRange: { min: 50, max: 80 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% grade 5+",
					},
				},
				card: { unit: "% grade 5+", digits: 1, maximum: 100 },
			},
			{
				id: "attainment8",
				label: "Attainment 8",
				field: "avgAtt8",
				colorRange: { min: 35, max: 60 },
				legend: {
					min: 0,
					max: 70,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: " Attainment 8",
					},
				},
				card: { unit: "Attainment 8", digits: 1, maximum: 70 },
			},
			{
				id: "progress8",
				label: "Progress 8",
				field: "avgP8score",
				colorRange: { min: -0.5, max: 0.5 },
				legend: {
					min: -1,
					max: 1,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: " Progress 8",
					},
				},
				card: { unit: "Progress 8", digits: 1, maximum: 1 },
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateSchoolPerformance,
		},
	},
});
