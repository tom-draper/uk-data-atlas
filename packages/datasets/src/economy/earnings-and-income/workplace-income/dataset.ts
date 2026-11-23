import type { WorkplaceIncomeDataset } from "../../../types/income.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { averagePay } from "../../../data/income/aggregate.ts";
import { payStatistics } from "../../../data/income/statistics.ts";
import {
	payStatisticsPart,
	workplaceIncomeFiles,
} from "../../../data/income/source.ts";

export const workplaceIncome = defineDataset<WorkplaceIncomeDataset>({
	id: "workplace-income",
	topic: "earnings-and-income",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	guide: {
		title: "Workplace income",
		about: "Pay for jobs based in each local authority in England, whoever does them. Enable the Workplace Pay card and select annual or hourly pay, median or mean. Regional figures average the available authority estimates without population weighting. Compare it with the resident Income card to see differences between where people work and live.",
		summary:
			"Median and mean annual and hourly pay for employees in each English local authority, by where their jobs are located. Enable the Workplace Pay card to map earnings where jobs are located. Its legend offers annual or hourly median and mean pay, separately from the resident Income card. Regional workplace figures average available authority estimates; suppressed estimates remain unavailable.",
	},
	sources: [{ name: "income" }, { name: "income-history" }],
	mapName: "Workplace Pay",
	source: {
		name: "Workplace income",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/workplacebylocalauthorityashetable7",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Earnings estimates by local authority of workplace for England.",
		cadence: "annual",
		notes: [
			"Annual Survey of Hours and Earnings, 2025 provisional results, Table 7: pay of employee jobs by the local authority where the employee works. Every employee job counts, full and part time; the self-employed are not included.",
			"Gross pay, before tax and other deductions. The mean and percentiles the table also publishes are not served.",
			"Provisional results are revised when the following year's survey is published.",
		],
	},
	statistics: {
		name: "ladName",
		payload: {
			parts: yearParts("workplace-income", "localAuthority", 2025, {
				coverageCountries: ["GB-ENG"],
			}),
			code: "ladCode",
		},
		...payStatistics("workplace"),
		direct: {
			only: true,
			// Each workbook holds the same table split by sex and hours; "All" is the
			// sheet covering every employee job.
			read: ({ xlsxSheet }) =>
				payStatisticsPart(
					(path) => xlsxSheet(path, "All"),
					"workplace",
					workplaceIncomeFiles,
				),
		},
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
				id: "median-workplace-annual-pay",
				label: "Median gross annual workplace pay",
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
					"earnings-place": "workplace",
					"pay-statistic": "median",
				},
			},
			{
				id: "median-workplace-hourly-pay",
				label: "Median gross hourly workplace pay",
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
					"earnings-place": "workplace",
					"pay-statistic": "median",
				},
			},
		],
	},
	display: {
		label: "Workplace Pay [2025]",
		year: 2025,
		card: {
			heading: "Workplace pay",
			coverage: "England",
			source: "ONS. ASHE Table 7, workplace-based pay, 2025.",
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
