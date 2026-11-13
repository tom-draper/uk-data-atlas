import type { PublicHealthDataset } from "./loader.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { averagePublicHealth } from "./aggregate.ts";
import { loadPublicHealth } from "./loader.ts";

export const publicHealth = defineDataset<PublicHealthDataset>({
	id: "public-health",
	topic: "health-status",
	boundary: { type: "countyAndUnitaryAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Public health indicators",
		publisher: "Office for Health Improvement and Disparities",
		sourceUrl:
			"https://fingertips.phe.org.uk/profile/public-health-outcomes-framework",
		year: "2024 to 2024/25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for Health Improvement and Disparities. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Selected Public Health Outcomes Framework indicators for English counties and unitary authorities, persons, at the latest collected period for each indicator.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 140,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["metrics"],
	},
	load: ({ csvRows }) => loadPublicHealth(csvRows),
	statistics: {
		payload: {
			parts: () => [
				{
					key: "2025",
					header: {
						id: "public-health2025",
						type: "public-health",
						year: 2025,
						boundaryType: "countyAndUnitaryAuthority",
						boundaryYear: 2025,
						periods: {
							receptionExcessWeight: "2024/25",
							year6ExcessWeight: "2024/25",
							adultExcessWeight: "2024/25",
							activity: "2024/25",
							smoking: "2024",
							preventableMortality: "2024",
						},
						coverageCountries: ["GB-ENG"],
					},
				},
			],
			code: "code",
			omitMissing: ["metrics."],
		},
		name: "name",
		alsoIn: [{ geography: "localAuthority", year: 2022 }],
		period: () => periods.financialYear(2024),
		measures: [
			measure(
				"reception-excess-weight",
				"Reception children overweight or obese",
				"percent",
				"share",
				"none",
				"Children in reception year who are overweight or obese, as a percentage of those measured.",
			),
			measure(
				"year-6-excess-weight",
				"Year 6 children overweight or obese",
				"percent",
				"share",
				"none",
				"Children in year 6 who are overweight or obese, as a percentage of those measured.",
			),
			measure(
				"adult-excess-weight",
				"Adults overweight or obese",
				"percent",
				"share",
				"none",
				"Adults aged 18 and over classified as overweight or obese.",
			),
			measure(
				"physically-active-adults",
				"Physically active adults",
				"percent",
				"share",
				"none",
				"Adults aged 19 and over doing at least 150 moderate intensity equivalent minutes of activity a week.",
			),
			measure(
				"smoking-prevalence",
				"Smoking prevalence in adults",
				"percent",
				"share",
				"none",
				"Adults aged 18 and over who currently smoke.",
			),
			measure(
				"preventable-mortality",
				"Mortality from preventable causes",
				"per 100,000",
				"rate",
				"none",
				"Age-standardised deaths from causes considered preventable, per 100,000 people.",
			),
		],
		fields: (_key, header) => {
			const published = header.periods as Record<string, string>;
			/** NCMP years are school years; the survey years are financial years. */
			const at = (metric: string, school: boolean) => {
				const label = published[metric];
				const year = /^(\d{4})\/\d{2}$/.exec(label);
				if (year)
					return school
						? periods.academicYear(Number(year[1]))
						: periods.financialYear(Number(year[1]));
				if (/^\d{4}$/.test(label)) return periods.year(Number(label));
				throw new Error(`Unknown public health period ${label}`);
			};
			return [
				["receptionExcessWeight", "reception-excess-weight", true],
				["year6ExcessWeight", "year-6-excess-weight", true],
				["adultExcessWeight", "adult-excess-weight", false],
				["activity", "physically-active-adults", false],
				["smoking", "smoking-prevalence", false],
				["preventableMortality", "preventable-mortality", false],
			].map(([metric, slug, school]) => ({
				path: `metrics.${metric}`,
				measure: slug as string,
				at: at(metric as string, school as boolean),
			}));
		},
	},
	display: {
		group: "Health",
		label: "Public Health [2024-2025]",
		defaultVisible: false,
		year: 2025,
		card: {
			heading: "Public health",
			coverage: "England",
			source: "OHID. Public Health Outcomes Framework. Mortality is age-standardised. Regional summaries are unweighted authority means, not pooled population rates.",
			hoverRecord: true,
			secondaryText: "County / unitary authority estimate",
			secondaryHiddenWhen: "isAverage",
		},
		measures: [
			{
				id: "smoking",
				label: "Adult smoking (18+)",
				field: "metrics.smoking",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: { kind: "decimal", digits: 1, suffix: " %" },
				},
				card: {
					heading: "Adult smoking (18+)",
					period: "2024",
					unit: "%",
					digits: 1,
					maximum: 100,
				},
			},
			{
				id: "adultExcessWeight",
				label: "Adult overweight including obesity (18+)",
				field: "metrics.adultExcessWeight",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: { kind: "decimal", digits: 1, suffix: " %" },
				},
				card: {
					heading: "Adult overweight including obesity (18+)",
					period: "2024/25",
					unit: "%",
					digits: 1,
					maximum: 100,
				},
			},
			{
				id: "activity",
				label: "Physically active adults (19+)",
				field: "metrics.activity",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: { kind: "decimal", digits: 1, suffix: " %" },
				},
				card: {
					heading: "Physically active adults (19+)",
					period: "2024/25",
					unit: "%",
					digits: 1,
					maximum: 100,
				},
			},
			{
				id: "receptionExcessWeight",
				label: "Reception overweight including obesity (4-5)",
				field: "metrics.receptionExcessWeight",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: { kind: "decimal", digits: 1, suffix: " %" },
				},
				card: {
					heading: "Reception overweight including obesity (4-5)",
					period: "2024/25",
					unit: "%",
					digits: 1,
					maximum: 100,
				},
			},
			{
				id: "year6ExcessWeight",
				label: "Year 6 overweight including obesity (10-11)",
				field: "metrics.year6ExcessWeight",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: { kind: "decimal", digits: 1, suffix: " %" },
				},
				card: {
					heading: "Year 6 overweight including obesity (10-11)",
					period: "2024/25",
					unit: "%",
					digits: 1,
					maximum: 100,
				},
			},
			{
				id: "preventableMortality",
				label: "Preventable mortality under 75",
				field: "metrics.preventableMortality",
				colorRange: { min: 0, max: 400 },
				legend: {
					min: 0,
					max: 400,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: " per 100,000, age-standardised",
					},
				},
				card: {
					heading: "Preventable mortality under 75",
					period: "2024",
					unit: "per 100,000",
					digits: 1,
					maximum: 400,
				},
			},
		],
		aggregation: {
			scope: "any",
			aggregate: averagePublicHealth,
		},
	},
});
