import type { IndicatorDataset } from "../../../types/indicator.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { averageIndicator } from "../../../data/new-datasets/aggregate.ts";
import { loadAdultSocialCareActivity } from "../../../data/new-datasets/loader.ts";

export const adultSocialCareActivity = defineDataset<
	IndicatorDataset<"adult-social-care-activity">
>({
	id: "adult-social-care-activity",
	topic: "social-care",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	publishMapValues: true,
	source: {
		name: "Adult social care activity in England",
		publisher: "Department of Health and Social Care",
		sourceUrl:
			"https://www.gov.uk/government/statistics/adult-social-care-activity-report-england-2024-to-2025",
		year: "2024-25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department of Health and Social Care. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Clients receiving long-term support during the year, across ages 18 to 64 and 65 and over.",
		cadence: "annual",
		notes: [
			"Clients receiving long-term support during the year, across both published age bands.",
		],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	load: ({ odsContent }) => loadAdultSocialCareActivity(odsContent),
	statistics: {
		payload: {
			parts: yearParts(
				"adult-social-care-activity",
				"localAuthority",
				2025,
				{ coverageCountries: ["GB-ENG"] },
				["2025"],
			),
			code: "code",
		},
		name: "name",
		period: () => periods.financialYear(2024),
		measures: [
			measure(
				"long-term-support-clients",
				"Clients receiving long-term support",
				"clients",
				"count",
				"sum",
				"Adult social care clients receiving long-term support during the year.",
			),
		],
		fields: [{ path: "value", measure: "long-term-support-clients" }],
	},
	catalogue: {
		kind: "indicators",
		period: "2024-25",
		coverageNote:
			"Values are source-reported for the authorities included in the publisher's release.",
		indicators: [
			{
				id: "adult-social-care-activity",
				label: "Clients receiving long-term support",
				field: "value",
				valueKind: "count",
				unit: "clients",
				aggregation: "sum",
				notes: [],
				measure: "long-term-support-clients",
			},
		],
	},
	display: {
		label: "Long-term Support [2025]",
		year: 2025,
		card: {
			heading: "Long-term support clients",
			source: "Source and methodology are available in the data catalogue.",
			hoverRecord: true,
		},
		measures: [
			{
				id: "value",
				label: "Clients",
				field: "value",
				colorRange: { min: 0, max: 20000 },
				legend: {
					min: 0,
					max: 50000,
					format: { kind: "count", locale: "en-GB" },
				},
				card: { unit: "clients", maximum: 50000 },
			},
		],
		aggregation: { scope: "any", aggregate: averageIndicator },
	},
});
