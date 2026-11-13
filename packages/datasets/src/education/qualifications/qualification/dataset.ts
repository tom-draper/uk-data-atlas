import type { QualificationDataset } from "../../../types/qualification.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import {
	CENSUS_LICENCE,
	census2021,
	districts2021,
} from "../../../data/census/districts.ts";
import { aggregateQualifications } from "../../../data/qualification/aggregate.ts";
import { loadQualification } from "../../../data/qualification/loader.ts";

export const qualification = defineDataset<QualificationDataset>({
	id: "qualification",
	topic: "qualifications",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
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
	load: ({ text }) => loadQualification(text),
	statistics: {
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
	display: {
		label: "Qualifications [2021]",
		year: 2021,
		component:
			"@/components/datasets/education/qualifications/qualification/QualificationChart",
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
