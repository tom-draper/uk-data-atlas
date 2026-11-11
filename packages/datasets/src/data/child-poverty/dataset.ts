import type { ChildPovertyDataset } from "../../types/childPoverty.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { aggregateChildPoverty } from "./aggregate.ts";
import { loadChildPoverty } from "./loader.ts";

export const childPoverty = defineDataset<ChildPovertyDataset>({
	id: "child-poverty",
	module: "deprivation",
	boundary: { type: "localAuthority", year: 2024 },
	publishMapValues: true,
	source: {
		name: "Child Poverty",
		publisher: "Department for Work and Pensions",
		sourceUrl:
			"https://www.gov.uk/government/statistics/children-in-low-income-families-local-area-statistics-2022-to-2025",
		year: "2022 to 2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department for Work and Pensions. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Children aged under 16 living in relative low-income families, before housing costs, by local authority across the United Kingdom.",
		cadence: "annual",
		notes: [
			"Children under 16 in families with below 60% of median income before housing costs.",
		],
	},
	load: ({ odsTableRows }) => loadChildPoverty(odsTableRows),
	statistics: {
		payload: {
			parts: yearParts(
				"child-poverty",
				"localAuthority",
				2024,
				{ measure: "relativeLowIncomeBeforeHousingCosts" },
				["2022", "2023", "2024", "2025"],
			),
			code: "ladCode",
		},
		name: "ladName",
		/** Keys are the financial year's end. */
		period: (key) => periods.financialYear(Number(key) - 1),
		measures: [
			measure(
				"children-in-relative-low-income",
				"Children in relative low income families",
				"children",
				"count",
				"sum",
				"Children under 16 in families with below 60% of median income before housing costs.",
			),
			measure(
				"children-in-relative-low-income-rate",
				"Children in relative low income families, rate",
				"percent",
				"rate",
				"none",
				"Children in relative low income families before housing costs as a percentage of children under 16.",
			),
		],
		fields: [
			{ path: "childCount", measure: "children-in-relative-low-income" },
			{
				path: "childPovertyRate",
				measure: "children-in-relative-low-income-rate",
			},
		],
		derived: {
			childrenPopulation:
				"Computed by the compiler from the count and rate.",
		},
		computed: {
			childrenPopulation: (record) =>
				(record.childCount as number) /
				((record.childPovertyRate as number) / 100),
		},
	},
	display: {
		group: "Economics",
		label: "Child Poverty [2025]",
		defaultVisible: true,
		year: 2025,
		card: {
			heading: "Child Poverty",
			coverage: "United Kingdom",
			source: "DWP. Children in relative low-income families, before housing costs.",
			secondary: {
				field: "childCount",
				format: { kind: "compact", suffix: " affected" },
			},
		},
		measures: [
			{
				id: "rate",
				label: "Rate",
				field: "childPovertyRate",
				colorRange: { min: 10, max: 35 },
				legend: {
					min: 0,
					max: 60,
					format: { kind: "decimal", digits: 0, suffix: "%" },
				},
				// Rates above 40% are uncommon; cap the bar there to retain contrast.
				card: { unit: "% children", digits: 1, maximum: 40 },
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateChildPoverty,
		},
	},
});
