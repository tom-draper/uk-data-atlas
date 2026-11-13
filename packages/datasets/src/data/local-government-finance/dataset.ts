import type { IndicatorDataset } from "../../types/indicator.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { aggregateIndicator } from "../new-datasets/aggregate.ts";
import { loadLocalGovernmentFinance } from "../new-datasets/loader.ts";

export const localGovernmentFinance = defineDataset<
	IndicatorDataset<"local-government-finance">
>({
	id: "local-government-finance",
	topic: "public-finance",
	boundary: { type: "localAuthority", year: 2026 },
	coverageCountries: ["GB-ENG"],
	publishMapValues: true,
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
		requiredDataFields: ["value"],
	},
	load: ({ odsContent }) => loadLocalGovernmentFinance(odsContent),
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
	display: {
		group: "Economics",
		label: "Education Services Spending [2026]",
		defaultVisible: false,
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
