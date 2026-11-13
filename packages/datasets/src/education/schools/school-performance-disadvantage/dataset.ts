import type { SchoolPerformanceGapDataset } from "../../../types/schoolPerformance.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import type {
	DeclaredDimension,
	DeclaredField,
} from "../../../declaration/statistics.ts";
import {
	SCHOOL_MEASURES,
	latestCopies,
	latestCopyRules,
	schoolYear,
	schoolYears,
} from "../../../data/school-performance/statistics.ts";
import { aggregateSchoolPerformanceGap } from "../../../data/school-performance-disadvantage/aggregate.ts";
import { loadSchoolPerformanceDisadvantage } from "../../../data/school-performance-disadvantage/loader.ts";

const DISADVANTAGE: DeclaredDimension = {
	slug: "disadvantage",
	label: "Disadvantage",
	members: [
		{ key: "disadvantaged", label: "Disadvantaged pupils" },
		{ key: "not-disadvantaged", label: "Other pupils" },
	],
};

const gapFields = (prefix: string): DeclaredField[] => [
	...(
		[
			["att8Disadvantaged", "attainment-8", "disadvantaged"],
			["att8NotDisadvantaged", "attainment-8", "not-disadvantaged"],
			["disadvantagedPupils", "key-stage-4-pupils", "disadvantaged"],
			[
				"notDisadvantagedPupils",
				"key-stage-4-pupils",
				"not-disadvantaged",
			],
		] as const
	).map(([field, measure, group]) => ({
		path: `${prefix}${field}`,
		measure,
		members: { disadvantage: group },
		period: schoolYear,
	})),
	{
		path: `${prefix}engmath94Gap`,
		measure: "gcse-english-maths-grade-4-gap",
		period: schoolYear,
	},
];

const GAP_COPIES = [
	"att8Disadvantaged",
	"att8NotDisadvantaged",
	"att8Gap",
	"engmath94Gap",
	"disadvantagedPupils",
	"notDisadvantagedPupils",
];

/** The compiler leaves a gap null where either side has fewer pupils. */
const GAP_MINIMUM_PUPILS = 6;

export const schoolPerformanceDisadvantage =
	defineDataset<SchoolPerformanceGapDataset>({
		id: "school-performance-disadvantage",
		topic: "schools",
		boundary: { type: "localAuthority", year: 2024 },
		coverageCountries: ["GB-ENG"],
		source: {
			name: "Attainment 8 Gap",
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
				"How far non-disadvantaged pupils are ahead of disadvantaged pupils at Key Stage 4, by local authority district for England. Derived from the published disadvantage breakdown as a plain difference in Attainment 8, not the Department's rank-based disadvantage gap index.",
			retrievedAt: "2026-09-06",
			cadence: "annual",
			notes: [],
		},
		ingestion: {
			expectedBoundaryYears: [2024],
			requiredDataFields: ["ladCode", "ladName"],
		},
		load: ({ text }) => loadSchoolPerformanceDisadvantage(text),
		statistics: {
			payload: {
				parts: yearParts(
					"school-performance-disadvantage",
					"localAuthority",
					2024,
					{ coverageCountries: ["GB-ENG"] },
					["2025"],
				),
				code: "ladCode",
				periodKeys: schoolYears,
				sparsePeriods: true,
			},
			name: "ladName",
			period: schoolYear,
			alsoIn: [
				{ geography: "localAuthority", year: 2022 },
				{ geography: "localAuthority", year: 2018 },
			],
			measures: [
				...SCHOOL_MEASURES,
				measure(
					"gcse-english-maths-grade-4-gap",
					"Disadvantage gap in English and maths at grade 4 or above",
					"percentage points",
					"rate",
					"none",
					"Other pupils' rate of grade 4 or above in English and maths less disadvantaged pupils' rate.",
				),
			],
			dimensions: [DISADVANTAGE],
			fields: gapFields("series.{period}."),
			derived: {
				...latestCopies(GAP_COPIES),
				"series.{period}.att8Gap":
					"Other pupils' Attainment 8 less disadvantaged pupils'.",
			},
			computed: {
				// The yearly gaps first, so the copies read them.
				"series.{period}.att8Gap": (record, path) => {
					const series = record.series as Record<
						string,
						Record<string, number | null>
					>;
					const year = series[path[1]];
					const ahead = year.att8NotDisadvantaged;
					const behind = year.att8Disadvantaged;
					const aheadPupils = year.notDisadvantagedPupils;
					const behindPupils = year.disadvantagedPupils;
					if (ahead === null || behind === null) return null;
					if (aheadPupils === null || behindPupils === null)
						return null;
					if (
						aheadPupils < GAP_MINIMUM_PUPILS ||
						behindPupils < GAP_MINIMUM_PUPILS
					)
						return null;
					return Number((ahead - behind).toFixed(1));
				},
				...latestCopyRules(GAP_COPIES),
			},
		},
		display: {
			label: "Attainment 8 Gap [2024/25]",
			year: 2025,
			card: {
				heading: "Attainment 8 Gap",
				period: "2024/25",
				coverage: "England",
				source: "Department for Education. Key Stage 4 Performance 2024/25. Difference in average Attainment 8 between pupils not known to be disadvantaged and disadvantaged pupils.",
				secondary: {
					field: "att8Disadvantaged",
					versus: "att8NotDisadvantaged",
					format: { kind: "decimal", digits: 1 },
				},
			},
			measures: [
				{
					id: "gap",
					label: "Gap",
					field: "att8Gap",
					// England's districts run from about six points to about twenty-nine.
					colorRange: { min: 10, max: 25 },
					legend: {
						min: 0,
						max: 35,
						format: {
							kind: "decimal",
							digits: 0,
							suffix: " pts behind",
						},
					},
					// Roughly the widest gap in England, so the bar spans the real spread.
					card: { unit: "pts behind", digits: 1, maximum: 30 },
				},
			],
			aggregation: {
				scope: "localAuthority",
				aggregate: aggregateSchoolPerformanceGap,
			},
		},
	});
