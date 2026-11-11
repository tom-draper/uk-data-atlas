import type { IndicatorDataset } from "../../types/indicator.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { HOUSEHOLDS } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { sumMetrics } from "../../helpers/sumMetrics.ts";
import { loadHousingTenure } from "./loader.ts";

export const housingTenure = defineDataset<IndicatorDataset<"housing-tenure">>({
	id: "housing-tenure",
	module: "housing",
	boundary: { type: "lsoa", year: 2021 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	source: {
		name: "Housing tenure",
		publisher: "Office for National Statistics",
		sourceUrl: "https://www.ons.gov.uk/datasets/ts054",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Census 2021 housing tenure counts for LSOAs in England and Wales.",
		cadence: "decennial",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 35000,
		expectedBoundaryYears: [2021],
		requiredDataFields: ["value", "metrics"],
	},
	load: ({ csvRows }) => loadHousingTenure(csvRows),
	statistics: {
		payload: {
			parts: yearParts(
				"housing-tenure",
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
		measures: [HOUSEHOLDS],
		dimensions: [
			{
				slug: "tenure",
				label: "Tenure",
				members: [
					{ key: "total", code: "total", label: "All households" },
					{
						key: "owned",
						code: "owned",
						label: "Owned",
						parent: "total",
					},
					{
						key: "outright",
						code: "owned-outright",
						label: "Owns outright",
						parent: "owned",
					},
					{
						key: "mortgage",
						code: "owned-with-mortgage",
						label: "Owns with a mortgage or loan",
						parent: "owned",
					},
					{
						key: "shared",
						code: "shared-ownership",
						label: "Shared ownership",
						parent: "total",
					},
					{
						key: "social",
						code: "social-rented",
						label: "Social rented",
						parent: "total",
					},
					{
						key: "private",
						code: "private-rented",
						label: "Private rented",
						parent: "total",
					},
					{
						key: "rentFree",
						code: "rent-free",
						label: "Lives rent free",
						parent: "total",
					},
				],
			},
		],
		fields: [{ path: "metrics.{tenure}", measure: "households" }],
		derived: {
			value: "Owned households as a percentage of all households.",
		},
		computed: {
			value: (record) => {
				const metrics = record.metrics as Record<string, number>;
				return (metrics.owned / metrics.total) * 100;
			},
		},
	},
	display: {
		group: "Economics",
		label: "Housing Tenure [2021]",
		defaultVisible: false,
		year: 2021,
		card: {
			heading: "Housing tenure",
			coverage: "England & Wales",
			source: "ONS. Census 2021, TS054. LSOA 2021 boundaries.",
			hoverRecord: true,
		},
		measures: [
			{
				id: "owned",
				label: "Owned",
				field: {
					share: { of: "metrics.owned", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% households",
					},
				},
				card: {
					unit: "% households",
					digits: 1,
					maximum: 100,
					note: "Owned",
				},
			},
			{
				id: "outright",
				label: "Owned outright",
				field: {
					share: { of: "metrics.outright", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% households",
					},
				},
				card: {
					unit: "% households",
					digits: 1,
					maximum: 100,
					note: "Owned outright",
				},
			},
			{
				id: "mortgage",
				label: "Owned with mortgage or loan",
				field: {
					share: { of: "metrics.mortgage", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% households",
					},
				},
				card: {
					unit: "% households",
					digits: 1,
					maximum: 100,
					note: "Owned with mortgage or loan",
				},
			},
			{
				id: "shared",
				label: "Shared ownership",
				field: {
					share: { of: "metrics.shared", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% households",
					},
				},
				card: {
					unit: "% households",
					digits: 1,
					maximum: 100,
					note: "Shared ownership",
				},
			},
			{
				id: "social",
				label: "Social rented",
				field: {
					share: { of: "metrics.social", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% households",
					},
				},
				card: {
					unit: "% households",
					digits: 1,
					maximum: 100,
					note: "Social rented",
				},
			},
			{
				id: "private",
				label: "Private rented",
				field: {
					share: { of: "metrics.private", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% households",
					},
				},
				card: {
					unit: "% households",
					digits: 1,
					maximum: 100,
					note: "Private rented",
				},
			},
			{
				id: "rentFree",
				label: "Lives rent free",
				field: {
					share: { of: "metrics.rentFree", over: "metrics.total" },
				},
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% households",
					},
				},
				card: {
					unit: "% households",
					digits: 1,
					maximum: 100,
					note: "Lives rent free",
				},
			},
		],
		aggregation: {
			scope: "lsoa",
			// Owned households as a share of all households.
			aggregate: (records) => sumMetrics(records, "owned", "total"),
		},
	},
});
