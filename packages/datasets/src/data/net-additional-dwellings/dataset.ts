import type { IndicatorDataset } from "../../types/indicator.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { averageIndicator } from "../new-datasets/aggregate.ts";
import { loadNetAdditionalDwellings } from "../new-datasets/loader.ts";

export const netAdditionalDwellings = defineDataset<
	IndicatorDataset<"net-additional-dwellings">
>({
	id: "net-additional-dwellings",
	module: "housing",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	publishMapValues: true,
	source: {
		name: "Housing supply: net additional dwellings",
		publisher: "Ministry of Housing, Communities and Local Government",
		sourceUrl:
			"https://www.gov.uk/government/collections/net-supply-of-housing",
		year: "2024-25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Ministry of Housing, Communities and Local Government. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Net additional dwellings by English local authority district.",
		cadence: "annual",
		notes: [
			"Annual net additional dwellings in English local authority districts.",
		],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	load: ({ odsContent }) => loadNetAdditionalDwellings(odsContent),
	statistics: {
		payload: {
			parts: yearParts(
				"net-additional-dwellings",
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
				"net-additional-dwellings",
				"Net additional dwellings",
				"dwellings",
				"count",
				"sum",
				"New dwellings and conversions less demolitions over the year.",
			),
		],
		fields: [{ path: "value", measure: "net-additional-dwellings" }],
	},
	catalogue: {
		kind: "indicators",
		period: "2024-25",
		coverageNote:
			"Values are source-reported for the authorities included in the publisher's release.",
		indicators: [
			{
				id: "net-additional-dwellings",
				label: "Net additional dwellings",
				field: "value",
				valueKind: "count",
				unit: "dwellings",
				aggregation: "sum",
				notes: [],
				measure: "net-additional-dwellings",
			},
		],
	},
	display: {
		group: "Economics",
		label: "Net Additional Dwellings [2025]",
		defaultVisible: false,
		year: 2025,
		card: {
			heading: "Net additional dwellings",
			source: "Source and methodology are available in the data catalogue.",
			hoverRecord: true,
		},
		measures: [
			{
				id: "value",
				label: "Dwellings",
				field: "value",
				colorRange: { min: 0, max: 5000 },
				legend: {
					min: 0,
					max: 10000,
					format: { kind: "count", locale: "en-GB" },
				},
				card: { unit: "homes", maximum: 10000 },
			},
		],
		aggregation: { scope: "any", aggregate: averageIndicator },
	},
});
