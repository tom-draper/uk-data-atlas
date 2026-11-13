import type { IndicatorDataset } from "../../types/indicator.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure, per100k } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { aggregateIndicator } from "../new-datasets/aggregate.ts";
import { loadElectricVehicleChargers } from "../new-datasets/loader.ts";

export const electricVehicleChargers = defineDataset<
	IndicatorDataset<"electric-vehicle-chargers">
>({
	id: "electric-vehicle-chargers",
	topic: "vehicles",
	related: ["energy"],
	boundary: { type: "localAuthority", year: 2026 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	source: {
		name: "Public electric vehicle chargers by local authority",
		publisher: "Department for Transport",
		sourceUrl:
			"https://www.gov.uk/government/collections/electric-vehicle-charging-infrastructure-statistics",
		year: "1 July 2026",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department for Transport. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Publicly available electric-vehicle chargers by local authority.",
		cadence: "quarterly",
		notes: [
			"Publicly available chargers by local authority at 1 July 2026.",
		],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2026],
		requiredDataFields: ["value"],
	},
	load: ({ odsContent, xlsxSheet }) =>
		loadElectricVehicleChargers(odsContent, xlsxSheet),
	statistics: {
		payload: {
			header: {
				coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
			},
			code: "code",
		},
		name: "name",
		period: () => periods.date("2026-07-01"),
		measures: [
			measure(
				"public-ev-chargers",
				"Public electric vehicle chargers",
				"chargers",
				"count",
				"sum",
				"Publicly available electric vehicle charging devices.",
			),
		],
		fields: [{ path: "value", measure: "public-ev-chargers" }],
		...per100k((record) => record.value, 2024),
	},
	catalogue: {
		kind: "indicators",
		period: "2026-07-01",
		coverageNote:
			"Values are source-reported for the authorities included in the publisher's release.",
		indicators: [
			{
				id: "electric-vehicle-chargers",
				label: "Public electric vehicle chargers",
				field: "value",
				valueKind: "count",
				unit: "chargers",
				aggregation: "sum",
				notes: [],
				measure: "public-ev-chargers",
			},
		],
	},
	display: {
		label: "Public EV Chargers [2026]",
		year: 2026,
		card: {
			heading: "Public EV chargers",
			source: "Source and methodology are available in the data catalogue.",
			hoverRecord: true,
			fixedMeasure: "total",
		},
		measures: [
			{
				id: "total",
				label: "Total",
				field: "value",
				colorRange: { min: 0, max: 1500 },
				legend: {
					min: 0,
					max: 5000,
					format: { kind: "count", locale: "en-GB" },
				},
				card: { unit: "chargers", maximum: 5000 },
			},
			{
				id: "perPopulation",
				label: "Per pop.",
				field: "metrics.per100kPopulation",
				colorRange: { min: 0, max: 500 },
				legend: {
					min: 0,
					max: 1000,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: " per 100k residents",
					},
				},
			},
		],
		aggregation: { scope: "any", aggregate: aggregateIndicator },
	},
});
