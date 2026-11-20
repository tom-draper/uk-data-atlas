import { directIndicator } from "../../../data/new-datasets/directIndicator.ts";
import { parseNullableNum } from "../../../helpers/parseNumber.ts";
import type { IndicatorDataset } from "../../../types/indicator.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { aggregateIndicator } from "../../../data/new-datasets/aggregate.ts";

export const localGovernmentFinance = defineDataset<
	IndicatorDataset<"local-government-finance">
>({
	id: "local-government-finance",
	topic: "public-finance",
	boundary: { type: "localAuthority", year: 2026 },
	coverageCountries: ["GB-ENG"],
	guide: {
		title: "Local authority revenue expenditure and financing",
		about: "What English councils plan to spend on their services this financial year, from their budget returns to government. The Atlas maps spending on education services.",
		summary: "English local-authority revenue budgets.",
	},
	mapName: "Council Education Spending",
	source: {
		name: "Local authority revenue expenditure and financing",
		publisher: "Ministry of Housing, Communities and Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistics/local-authority-revenue-expenditure-and-financing-england-2026-to-2027-budget",
		year: "2026-27",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Ministry of Housing, Communities and Local Government. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"English local-authority revenue budget estimates; the Atlas map shows total education-services expenditure.",
		cadence: "annual",
		notes: [
			"The Atlas primary measure is the published total education-services budget line.",
		],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2026],
	},
	statistics: {
		payload: {
			parts: yearParts(
				"local-government-finance",
				"localAuthority",
				2026,
				{ coverageCountries: ["GB-ENG"] },
				["2026"],
			),
			code: "code",
		},
		name: "name",
		period: () => periods.financialYear(2026),
		measures: [
			measure(
				"education-services-budget",
				"Education services revenue budget",
				"gbp thousand",
				"amount",
				"sum",
				"Budgeted net revenue expenditure on education services.",
			),
		],
		fields: [{ path: "value", measure: "education-services-budget" }],
		direct: {
			only: true,
			read: (reader) =>
				directIndicator(reader, {
					id: "local-government-finance",
					file: "RA_2026-27_data_Part_1.ods",
					table: "RA_LA_Data_2026-27",
					columns: 128,
					key: "2026",
					measure: "education-services-budget",
					read: (rows) => {
						const target = (rows[9] ?? []).indexOf(
							"TOTAL EDUCATION SERVICES",
						);
						return rows.slice(10).map((row) => ({
							code: row[1]?.trim() ?? "",
							name: row[2]?.trim() ?? "",
							value: parseNullableNum(row[target]),
						}));
					},
				}),
		},
	},
	catalogue: {
		kind: "indicators",
		period: "2026-27",
		coverageNote:
			"Values are source-reported for the authorities included in the publisher's release.",
		indicators: [
			{
				id: "local-government-finance",
				label: "Education services revenue budget",
				field: "value",
				valueKind: "quantity",
				unit: "£ thousand",
				aggregation: "sum",
				notes: [],
				measure: "education-services-budget",
			},
		],
	},
	ranking: {
		label: "Education services spending",
		format: {
			kind: "count",
			locale: "en-GB",
			round: true,
			scale: 1000,
			prefix: "£",
		},
	},
	display: {
		label: "Education Services Spending [2026]",
		year: 2026,
		card: {
			heading: "Education services spending",
			source: "Source and methodology are available in the data catalogue.",
			hoverRecord: true,
		},
		measures: [
			{
				id: "value",
				label: "Spending",
				field: "value",
				colorRange: { min: 0, max: 300000 },
				legend: {
					min: 0,
					max: 1000000,
					format: {
						kind: "count",
						locale: "en-GB",
						prefix: "£",
						suffix: "k",
					},
				},
				card: { unit: "£k", prefix: "£", maximum: 1000000 },
			},
		],
		aggregation: { scope: "any", aggregate: aggregateIndicator },
	},
});
