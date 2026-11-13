import type { IndicatorDataset } from "../../types/indicator.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure, per100k } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { averageIndicator } from "../new-datasets/aggregate.ts";
import { loadBusinessActivity } from "../new-datasets/loader.ts";

export const businessActivity = defineDataset<
	IndicatorDataset<"business-activity">
>({
	id: "business-activity",
	topic: "business",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	source: {
		name: "UK business: activity, size and location",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation/datasets/ukbusinessactivitysizeandlocation",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"VAT and/or PAYE based enterprises by local authority district, summed across published broad industries.",
		cadence: "annual",
		notes: [
			"The primary value sums the published broad-industry counts for each local authority.",
		],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	load: ({ xlsxSheet }) => loadBusinessActivity(xlsxSheet, xlsxSheet),
	statistics: {
		payload: {
			header: {
				coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
			},
			code: "code",
		},
		name: "name",
		period: () => periods.year(2025),
		measures: [
			measure(
				"enterprises",
				"VAT and/or PAYE based enterprises",
				"enterprises",
				"count",
				"sum",
				"Enterprises registered for VAT or PAYE, summed over the published broad industry groups.",
			),
		],
		fields: [{ path: "value", measure: "enterprises" }],
		...per100k((record) => record.value, 2024),
	},
	catalogue: {
		kind: "indicators",
		period: "2025",
		coverageNote:
			"Values are source-reported for the authorities included in the publisher's release.",
		indicators: [
			{
				id: "business-activity",
				label: "VAT and/or PAYE based enterprises",
				field: "value",
				valueKind: "count",
				unit: "enterprises",
				aggregation: "sum",
				notes: [],
				measure: "enterprises",
			},
		],
	},
	display: {
		group: "Economics",
		label: "Businesses [2025]",
		defaultVisible: true,
		year: 2025,
		card: {
			heading: "Businesses",
			source: "Source and methodology are available in the data catalogue.",
			hoverRecord: true,
			fixedMeasure: "total",
		},
		measures: [
			{
				id: "total",
				label: "Total",
				field: "value",
				colorRange: { min: 0, max: 50000 },
				legend: {
					min: 0,
					max: 100000,
					format: { kind: "count", locale: "en-GB" },
				},
				card: { unit: "enterprises", maximum: 100000 },
			},
			{
				id: "perPopulation",
				label: "Per pop.",
				field: "metrics.per100kPopulation",
				colorRange: { min: 0, max: 12000 },
				legend: {
					min: 0,
					max: 20000,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: " per 100k residents",
					},
				},
			},
		],
		aggregation: { scope: "any", aggregate: averageIndicator },
	},
});
