import type { IndicatorDataset } from "../../types/indicator.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { USUAL_RESIDENTS } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { sumMetrics } from "../../helpers/sumMetrics.ts";
import { loadGeneralHealth } from "./loader.ts";

export const generalHealth = defineDataset<IndicatorDataset<"general-health">>({
	id: "general-health",
	topic: "health-status",
	boundary: { type: "lsoa", year: 2021 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	source: {
		name: "General health",
		publisher: "Office for National Statistics",
		sourceUrl: "https://www.ons.gov.uk/datasets/ts037",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Census 2021 general health counts for LSOAs in England and Wales.",
		cadence: "decennial",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 35000,
		expectedBoundaryYears: [2021],
		requiredDataFields: ["value", "metrics"],
	},
	load: ({ csvRows }) => loadGeneralHealth(csvRows),
	statistics: {
		payload: {
			parts: yearParts(
				"general-health",
				"lsoa",
				2021,
				{
					coverageCountries: ["GB-ENG", "GB-WLS"],
				},
				["2021"],
			),
			code: "code",
		},
		period: () => periods.census(2021),
		name: "name",
		measures: [USUAL_RESIDENTS],
		dimensions: [
			{
				slug: "general-health",
				label: "General health",
				members: [
					{
						key: "total",
						code: "total",
						label: "All usual residents",
					},
					{
						key: "veryGood",
						code: "very-good",
						label: "Very good health",
						parent: "total",
					},
					{
						key: "good",
						code: "good",
						label: "Good health",
						parent: "total",
					},
					{
						key: "fair",
						code: "fair",
						label: "Fair health",
						parent: "total",
					},
					{
						key: "bad",
						code: "bad",
						label: "Bad health",
						parent: "total",
					},
					{
						key: "veryBad",
						code: "very-bad",
						label: "Very bad health",
						parent: "total",
					},
				],
			},
		],
		fields: [
			{ path: "metrics.{general-health}", measure: "usual-residents" },
		],
		derived: {
			"metrics.goodHealth": "Very good plus good health.",
			value: "Good health as a percentage of all usual residents.",
		},
		computed: {
			"metrics.goodHealth": (record) => {
				const metrics = record.metrics as Record<string, number>;
				return metrics.veryGood + metrics.good;
			},
			value: (record) => {
				const metrics = record.metrics as Record<string, number>;
				return (metrics.goodHealth / metrics.total) * 100;
			},
		},
	},
	display: {
		label: "General health [2021]",
		year: 2021,
		card: {
			heading: "General health",
			coverage: "England & Wales",
			source: "ONS. Census 2021, TS037. LSOA 2021 boundaries.",
			hoverRecord: true,
		},
		measures: [
			{
				id: "goodHealth",
				label: "Good or very good health",
				field: {
					share: { of: "metrics.goodHealth", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% residents",
					},
				},
				card: {
					unit: "% residents",
					digits: 1,
					maximum: 100,
					note: "Good or very good health",
				},
			},
			{
				id: "veryGood",
				label: "Very good health",
				field: {
					share: { of: "metrics.veryGood", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% residents",
					},
				},
				card: {
					unit: "% residents",
					digits: 1,
					maximum: 100,
					note: "Very good health",
				},
			},
			{
				id: "good",
				label: "Good health",
				field: { share: { of: "metrics.good", over: "metrics.total" } },
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% residents",
					},
				},
				card: {
					unit: "% residents",
					digits: 1,
					maximum: 100,
					note: "Good health",
				},
			},
			{
				id: "fair",
				label: "Fair health",
				field: { share: { of: "metrics.fair", over: "metrics.total" } },
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% residents",
					},
				},
				card: {
					unit: "% residents",
					digits: 1,
					maximum: 100,
					note: "Fair health",
				},
			},
			{
				id: "bad",
				label: "Bad health",
				field: { share: { of: "metrics.bad", over: "metrics.total" } },
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% residents",
					},
				},
				card: {
					unit: "% residents",
					digits: 1,
					maximum: 100,
					note: "Bad health",
				},
			},
			{
				id: "veryBad",
				label: "Very bad health",
				field: {
					share: { of: "metrics.veryBad", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% residents",
					},
				},
				card: {
					unit: "% residents",
					digits: 1,
					maximum: 100,
					note: "Very bad health",
				},
			},
		],
		aggregation: {
			scope: "lsoa",
			// Good or very good health as a share of all usual residents.
			aggregate: (records) => sumMetrics(records, "goodHealth", "total"),
		},
	},
});
