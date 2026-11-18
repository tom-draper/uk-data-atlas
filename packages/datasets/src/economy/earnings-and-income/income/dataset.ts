import type { IncomeDataset } from "../../../types/income.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { averagePay } from "../../../data/income/aggregate.ts";
import { payStatistics } from "../../../data/income/statistics.ts";
import { payStatisticsPart, incomeFiles } from "../../../data/income/source.ts";

export const income = defineDataset<IncomeDataset>({
	id: "income",
	topic: "earnings-and-income",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	guide: {
		title: "Income",
		about: "Pay for employees who live in each local authority in England, from the Annual Survey of Hours and Earnings. Select annual or hourly pay and median or mean. The median is the middle value, so a few very high earners don't skew it. Regional hourly figures average the available authority estimates without population weighting.",
		summary:
			"Median and mean annual and hourly pay for employees in each English local authority, by where workers live. The income legend switches between annual and hourly pay and between median and mean. Regional cards show an unweighted average of the available authority estimates, rather than a pooled regional median or mean.",
	},
	source: {
		name: "Income",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/placeofresidencebylocalauthorityashetable8",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Earnings estimates by local authority of residence for England.",
		cadence: "annual",
		notes: [
			"Annual Survey of Hours and Earnings, 2025 provisional results, Table 8: pay of employee jobs by the local authority the employee lives. Every employee job counts, full and part time; the self-employed are not included.",
			"Gross pay, before tax and other deductions. The mean and percentiles the table also publishes are not served.",
			"Provisional results are revised when the following year's survey is published.",
		],
	},
	load: noCompiledPayload<IncomeDataset>(),
	placeHeadline: {
		places: ["localAuthority"],
		order: 10,
		label: "Median pay",
		about: "Annual pay of residents in full-time work",
	},
	statistics: {
		name: "ladName",
		payload: {
			parts: yearParts("income", "localAuthority", 2025, {
				coverageCountries: ["GB-ENG"],
			}),
			code: "ladCode",
		},
		...payStatistics("residence"),
		direct: {
			only: true,
			// Each workbook holds the same table split by sex and hours; "All" is the
			// sheet covering every employee job.
			read: ({ xlsxSheet }) =>
				payStatisticsPart(
					(path) => xlsxSheet(path, "All"),
					"residence",
					incomeFiles,
				),
		},
	},
	ranking: {
		label: "Median annual pay",
		format: { kind: "count", locale: "en-GB", round: true, prefix: "£" },
	},
	catalogue: {
		kind: "indicators",
		period: "2025",
		codes: "england2025",
		authorityCodes: /^E0[6-9]/,
		coverageNote:
			"Published source records cover English authorities only. An authority whose estimate the publisher suppressed as unreliable has no value.",
		indicators: [
			{
				id: "median-annual-pay",
				label: "Median gross annual pay",
				field: "annual.median",
				valueKind: "currency",
				unit: "£ per year",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "median",
					note: "A median of authorities' medians is not the median pay of their combined residents, and no weight recovers it.",
				},
				notes: [
					"Annual pay is estimated only for employees who have been in the same job for at least a year.",
				],
				measure: "gross-annual-pay",
				members: {
					"earnings-place": "residence",
					"pay-statistic": "median",
				},
			},
			{
				id: "median-hourly-pay",
				label: "Median gross hourly pay",
				field: "hourly.median",
				valueKind: "currency",
				unit: "£ per hour",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "median",
					note: "A median of authorities' medians is not the median pay of their combined residents, and no weight recovers it.",
				},
				notes: [
					"Gross hourly pay includes overtime pay and overtime hours; the publisher's separate table excluding overtime is not served.",
				],
				measure: "gross-hourly-pay",
				members: {
					"earnings-place": "residence",
					"pay-statistic": "median",
				},
			},
		],
	},
	display: {
		label: "Income [2025]",
		year: 2025,
		card: {
			heading: "Income",
			coverage: "England",
			source: "ONS. ASHE Table 8, residence-based pay, 2025.",
			secondaryText:
				"Regional values average available authority estimates",
			appearance: {
				background: "income",
				layout: "centered",
				accent: "#10b981",
			},
		},
		measures: [
			{
				id: "annualMedian",
				label: "Median annual pay",
				field: "annual.median",
				colorRange: { min: 25_000, max: 45_000 },
				legend: {
					min: 0,
					max: 80_000,
					format: { kind: "decimal", digits: 0, prefix: "£" },
				},
				card: {
					unit: "per year",
					format: { kind: "count", prefix: "£", round: true },
					maximum: 80_000,
				},
			},
			{
				id: "annualMean",
				label: "Mean annual pay",
				field: "annual.mean",
				colorRange: { min: 25_000, max: 45_000 },
				legend: {
					min: 0,
					max: 80_000,
					format: { kind: "decimal", digits: 0, prefix: "£" },
				},
				card: {
					unit: "per year",
					format: { kind: "count", prefix: "£", round: true },
					maximum: 80_000,
				},
			},
			{
				id: "hourlyMedian",
				label: "Median hourly pay",
				field: "hourly.median",
				colorRange: { min: 10, max: 30 },
				legend: {
					min: 0,
					max: 60,
					format: {
						kind: "decimal",
						digits: 2,
						prefix: "£",
						suffix: "/hour",
					},
				},
				card: {
					unit: "per hour",
					format: {
						kind: "decimal",
						digits: 2,
						prefix: "£",
						suffix: "/hour",
					},
					maximum: 60,
				},
			},
			{
				id: "hourlyMean",
				label: "Mean hourly pay",
				field: "hourly.mean",
				colorRange: { min: 10, max: 30 },
				legend: {
					min: 0,
					max: 60,
					format: {
						kind: "decimal",
						digits: 2,
						prefix: "£",
						suffix: "/hour",
					},
				},
				card: {
					unit: "per hour",
					format: {
						kind: "decimal",
						digits: 2,
						prefix: "£",
						suffix: "/hour",
					},
					maximum: 60,
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: averagePay,
		},
	},
});
