import type { IndicatorDataset } from "../../../types/indicator.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { averageIndicator } from "../../../data/new-datasets/aggregate.ts";
import { loadHousingAffordability } from "../../../data/new-datasets/loader.ts";

export const housingAffordability = defineDataset<
	IndicatorDataset<"housing-affordability">
>({
	id: "housing-affordability",
	topic: "prices-and-affordability",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	publishMapValues: true,
	related: ["earnings-and-income"],
	source: {
		name: "House price to residence-based earnings ratio",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/ratioofhousepricetoresidencebasedearningslowerquartileandmedian",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Ratio of the median price paid for existing dwellings to median gross annual residence-based earnings, by local authority district.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 300,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	load: ({ xlsxSheet }) => loadHousingAffordability(xlsxSheet),
	statistics: {
		payload: {
			parts: yearParts(
				"housing-affordability",
				"localAuthority",
				2025,
				{ coverageCountries: ["GB-ENG", "GB-WLS"] },
				["2025"],
			),
			code: "code",
		},
		name: "name",
		period: () => periods.year(2025),
		measures: [
			measure(
				"house-price-to-earnings-ratio",
				"House price to earnings ratio",
				"ratio",
				"index",
				"none",
				"Median price of existing dwellings divided by median gross annual residence-based earnings.",
			),
		],
		fields: [{ path: "value", measure: "house-price-to-earnings-ratio" }],
	},
	display: {
		label: "Housing Affordability [2025]",
		year: 2025,
		card: {
			heading: "House price to earnings",
			source: "Source and methodology are available in the data catalogue.",
			secondaryText: "Median ratio",
			hoverRecord: true,
		},
		measures: [
			{
				id: "value",
				label: "Ratio",
				field: "value",
				colorRange: { min: 4, max: 14 },
				legend: {
					min: 0,
					max: 20,
					format: { kind: "decimal", digits: 0, suffix: "×" },
				},
				card: { unit: "× earnings", digits: 1, maximum: 20 },
			},
		],
		aggregation: { scope: "any", aggregate: averageIndicator },
	},
});
