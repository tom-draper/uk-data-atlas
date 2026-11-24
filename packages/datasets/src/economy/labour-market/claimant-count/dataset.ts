import type { ClaimantCountDataset } from "../../../types/claimantCount.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import {
	CLAIMANT_AGE_GROUP,
	CLAIMANT_RATE,
	CLAIMANTS,
} from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { aggregateClaimantCount } from "./aggregate.ts";
import { claimantCountStatisticsPart } from "../../../data/claimant-count/source.ts";

export const claimantCount = defineDataset<ClaimantCountDataset>({
	id: "claimant-count",
	topic: "labour-market",
	guide: {
		title: "Claimant Count",
		about: "The share of working-age residents claiming unemployment-related benefits, Universal Credit or Jobseeker's Allowance, in each local authority. It's published monthly, so it's the most up-to-date local view of unemployment.",
		summary:
			"How many people in each local authority count as claimants of Universal Credit or Jobseeker's Allowance, in total and for 16 to 24 year olds.",
	},
	mapName: "Claimant Count",
	source: {
		name: "Claimant Count",
		publisher: "Office for National Statistics",
		sourceUrl: "https://www.nomisweb.co.uk/datasets/ucjsa",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Claimants of Universal Credit and Jobseeker's Allowance by local authority district for Great Britain.",
		year: "2026",
		cadence: "monthly",
		notes: [
			"People claiming Universal Credit or Jobseeker's Allowance principally for the reason of being unemployed, in April 2026. It counts claimants, not unemployment: the survey measure of unemployment includes people who claim nothing and excludes some who do.",
			"Counts are rounded by the publisher to the nearest five, so a sum over areas carries that rounding from every member.",
			"The published rates, claimants as a share of residents aged 16 to 64, are not served: a rate does not add over areas and would need the working-age population as a weight.",
			"The compiled dataset holds the four authorities created in April 2023 beside the districts they replaced; the districts are dropped after checking each authority is their exact sum, so no claimant is counted twice.",
		],
	},
	boundary: { type: "localAuthority", year: 2024 },
	placeHeadline: {
		places: ["localAuthority"],
		order: 60,
		label: "Claimant rate",
		about: "Residents aged 16 to 64 claiming out-of-work benefits",
	},
	statistics: {
		payload: { header: { month: "Apr 2026" }, code: "ladCode" },
		name: "ladName",
		period: () => periods.month(2026, 4),
		alsoIn: [{ geography: "localAuthority", year: 2022 }],
		direct: {
			only: true,
			read: async ({ text, xlsxSheet }) =>
				claimantCountStatisticsPart(text, xlsxSheet),
		},
		measures: [CLAIMANTS, CLAIMANT_RATE],
		dimensions: [CLAIMANT_AGE_GROUP],
		fields: [
			{ path: "{age-group}", measure: "claimants" },
			{ path: "totalRate", measure: "claimant-rate" },
		],
		derived: {
			youthRate: "Derived from the youth share of claimants.",
		},
		computed: {
			youthRate: (record) => {
				const total = record.totalCount as number;
				const youth = record.youthCount as number;
				const rate = record.totalRate as number;
				return total > 0 ? (youth / total) * rate : 0;
			},
		},
	},
	catalogue: {
		kind: "indicators",
		period: "2026-04",
		codes: "authorities",
		mergeApril2023: true,
		coverageNote:
			"Published source records cover every authority in all four UK nations.",
		indicators: [
			{
				id: "claimant-count",
				label: "Claimant count",
				field: "totalCount",
				valueKind: "count",
				unit: "claimants aged 16 and over",
				aggregation: "sum",
				notes: ["Every claimant aged 16 and over."],
				measure: "claimants",
				members: { "age-group": "16-plus" },
			},
			{
				id: "claimant-count-16-to-24",
				label: "Claimant count aged 16 to 24",
				field: "youthCount",
				valueKind: "count",
				unit: "claimants aged 16 to 24",
				aggregation: "sum",
				notes: [
					"Claimants aged 16 to 24, a subset of the claimant count.",
				],
				measure: "claimants",
				members: { "age-group": "16-to-24" },
			},
		],
	},
	ranking: {
		label: "Claimants, % of residents aged 16 to 64",
	},
	display: {
		label: "Claimant Count [2026]",
		year: 2026,
		component: "@/components/measures/MeasureSeriesChart",
		series: {
			heading: "Claimant Count",
			period: "2013-2026",
			source: "ONS/Nomis. Claimant Count (UC + JSA), every month from January 2013, restated on the authorities of April 2023. nomisweb.co.uk",
			accent: "#0ea5e9",
			measures: {
				rate: "claimant-rate",
				count: {
					measure: "claimants",
					dimensions: { "age-group": ["16-plus"] },
				},
			},
			countOf: {
				"claimant-rate": {
					measure: "claimants",
					dimensions: { "age-group": ["16-plus"] },
				},
			},
			// The monthly history is held apart from the single month the map shows.
			release: {
				datasetId: "claimant-count-history",
				boundaryYear: 2023,
			},
		},
		measures: [
			{
				id: "rate",
				label: "Rate",
				field: "totalRate",
				card: { unit: "% of 16–64", digits: 1, maximum: 10 },
				colorRange: { min: 1, max: 8 },
				legend: {
					min: 0,
					max: 20,
					format: { kind: "decimal", digits: 1, suffix: "%" },
				},
			},
			{
				id: "count",
				label: "Count",
				field: "totalCount",
				card: { unit: "claimants", maximum: 14000 },
				colorRange: { min: 1000, max: 14000 },
				legend: {
					min: 0,
					max: 80000,
					format: { kind: "count", suffix: " claimants" },
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateClaimantCount,
		},
	},
});
