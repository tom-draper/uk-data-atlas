import type { ClaimantCountDataset } from "../../types/claimantCount.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { aggregateClaimantCount } from "./aggregate.ts";
import { loadClaimantCount } from "./loader.ts";

export const claimantCount = defineDataset<ClaimantCountDataset>({
	id: "claimant-count",
	topic: "labour-market",
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
	load: ({ text, xlsxSheet }) => loadClaimantCount(text, xlsxSheet),
	statistics: {
		payload: { header: { month: "Apr 2026" }, code: "ladCode" },
		name: "ladName",
		period: () => periods.month(2026, 4),
		alsoIn: [{ geography: "localAuthority", year: 2022 }],
		measures: [
			measure(
				"claimants",
				"Claimants",
				"people",
				"count",
				"sum",
				"People claiming unemployment-related benefits (the claimant count).",
			),
			measure(
				"claimant-rate",
				"Claimant rate",
				"percent",
				"rate",
				"none",
				"Claimants as a percentage of residents aged 16 to 64. Published, except for authorities formed in 2023, where the compiler divides by the 2024 mid-year population.",
			),
		],
		dimensions: [
			{
				slug: "age-group",
				label: "Age group",
				members: [
					{
						key: "totalCount",
						code: "16-plus",
						label: "Aged 16 and over",
					},
					{
						key: "youthCount",
						code: "16-to-24",
						label: "Aged 16 to 24",
						parent: "totalCount",
					},
				],
			},
		],
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
	display: {
		group: "Economics",
		label: "Claimant Count [2026]",
		defaultVisible: true,
		year: 2026,
		card: {
			heading: "Claimant Count",
			source: "ONS/Nomis. Claimant Count (UC + JSA). nomisweb.co.uk",
			coverage: "Great Britain",
			secondary: {
				field: "youthRate",
				format: { kind: "decimal", digits: 1, suffix: "% youth" },
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
