import type { QualificationDataset } from "../../../types/qualification.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import {
	CENSUS_LICENCE,
	census2021,
	districts2021,
} from "../../../data/census/districts.ts";
import { aggregateQualifications } from "../../../data/qualification/aggregate.ts";
import { qualificationStatisticsParts } from "../../../data/qualification/source.ts";

export const qualification = defineDataset<QualificationDataset>({
	id: "qualification",
	topic: "qualifications",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	guide: {
		title: "Qualifications",
		about: "The highest qualification held by residents aged 16 and over in the 2021 Census, from no qualifications up to degree level. The Atlas maps the share of residents with a degree or equivalent.",
		summary:
			"The highest qualification held by residents aged 16 and over in each local authority in England and Wales, from Census 2021.",
	},
	source: {
		name: "Qualifications",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/datasets/TS067/editions/2021/versions/3",
		year: "2021",
		...CENSUS_LICENCE,
		description:
			"Highest level of qualification breakdown by local authority district for England and Wales (Census 2021).",
		cadence: "decennial",
		notes: [],
	},
	load: noCompiledPayload<QualificationDataset>(),
	placeHeadline: {
		places: ["localAuthority"],
		order: 100,
		label: "Degree-educated",
		about: "Residents with a degree-level qualification or above",
	},
	statistics: {
		direct: {
			only: true,
			read: ({ text }) => qualificationStatisticsParts(text),
		},
		payload: {
			parts: () => [
				{
					key: "2021",
					header: {
						id: "qualifications2021",
						type: "qualification",
						year: 2021,
						boundaryType: "localAuthority",
						boundaryYear: 2025,
						metadata: {
							source: "Office for National Statistics. Census 2021: Highest Level of Qualification, England and Wales. TS067.",
							notes: [
								"England and Wales only. Covers usual residents aged 16 and over; residents under 16, whom the table records as 'Does not apply', are excluded.",
							],
						},
						coverageCountries: ["GB-ENG", "GB-WLS"],
					},
				},
			],
			code: "ladCode",
		},
		...districts2021,
		period: census2021,
		measures: [
			measure(
				"usual-residents-16-plus",
				"Usual residents aged 16 and over",
				"people",
				"count",
				"sum",
				"Usual residents aged 16 and over counted by the census.",
			),
		],
		dimensions: [
			{
				slug: "highest-qualification",
				label: "Highest level of qualification",
				members: [
					{
						key: "total",
						code: "total",
						label: "All usual residents aged 16 and over",
					},
					{
						key: "noQualifications",
						code: "none",
						label: "No qualifications",
						parent: "total",
					},
					{
						key: "level1",
						code: "level-1",
						label: "Level 1 and entry level",
						parent: "total",
					},
					{
						key: "level2",
						code: "level-2",
						label: "Level 2",
						parent: "total",
					},
					{
						key: "apprenticeship",
						code: "apprenticeship",
						label: "Apprenticeship",
						parent: "total",
					},
					{
						key: "level3",
						code: "level-3",
						label: "Level 3",
						parent: "total",
					},
					{
						key: "level4Plus",
						code: "level-4-plus",
						label: "Level 4 and above",
						parent: "total",
					},
					{
						key: "other",
						code: "other",
						label: "Other qualifications",
						parent: "total",
					},
				],
			},
		],
		fields: [
			{
				path: "breakdown.{highest-qualification}",
				measure: "usual-residents-16-plus",
			},
		],
	},
	ranking: {
		label: "Residents with degree-level qualifications",
		format: { kind: "decimal", digits: 1, suffix: "%" },
	},
	display: {
		label: "Qualifications [2021]",
		year: 2021,
		component: "@/components/measures/MeasureBreakdownChart",
		breakdown: {
			heading: "Qualifications",
			period: "2021",
			source: "Office for National Statistics. Census 2021: Highest Level of Qualification, England and Wales. TS067.",
			coverage: "England & Wales",
			measure: "usual-residents-16-plus",
			dimension: "highest-qualification",
			total: "total",
			parts: [
				{ code: "level-4-plus", color: "#3b82f6", label: "Level 4+" },
				{ code: "level-3", color: "#22c55e", label: "Level 3" },
				{
					code: "apprenticeship",
					color: "#84cc16",
					label: "Apprenticeship",
				},
				{ code: "level-2", color: "#eab308", label: "Level 2" },
				{ code: "level-1", color: "#f97316", label: "Level 1" },
				{ code: "none", color: "#ef4444", label: "No qualifications" },
				{ code: "other", color: "#9ca3af", label: "Other" },
			],
			accent: "level-4-plus",
		},
		measures: [
			{
				id: "level-4-plus",
				label: "Residents with Level 4 or above",
				field: {
					share: {
						of: "breakdown.level4Plus",
						over: "breakdown.total",
					},
				},
				colorRange: { min: 25, max: 60 },
				legend: {
					min: 25,
					max: 60,
					format: { kind: "decimal", digits: 0, suffix: "%" },
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			distinct: true,
			aggregate: aggregateQualifications,
		},
	},
});
