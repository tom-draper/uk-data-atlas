import type { WorkplaceIncomeDataset } from "../../types/income.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { averagePay } from "../income/aggregate.ts";
import { loadWorkplaceIncome } from "../income/loader.ts";
import { payStatistics } from "../income/statistics.ts";

export const workplaceIncome = defineDataset<WorkplaceIncomeDataset>({
	id: "workplace-income",
	topic: "earnings-and-income",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
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
		notes: [],
	},
	// Each workbook holds the same table split by sex and hours; "All" is the
	// sheet covering every employee job.
	load: ({ xlsxSheet }) =>
		loadWorkplaceIncome((path) => xlsxSheet(path, "All")),
	statistics: {
		name: "ladName",
		payload: {
			parts: yearParts("workplace-income", "localAuthority", 2025, {
				coverageCountries: ["GB-ENG"],
			}),
			code: "ladCode",
		},
		...payStatistics("workplace"),
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
