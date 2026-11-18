import type { IndicatorDataset } from "../../../types/indicator.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { measure, per100k } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { aggregateIndicator } from "../../../data/new-datasets/aggregate.ts";
import { electricVehicleChargerStatisticsPart } from "../../../data/electric-vehicle-chargers/source.ts";

export const electricVehicleChargers = defineDataset<
	IndicatorDataset<"electric-vehicle-chargers">
>({
	id: "electric-vehicle-chargers",
	topic: "vehicles",
	related: ["energy"],
	boundary: { type: "localAuthority", year: 2026 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	guide: {
		title: "Public electric vehicle chargers by local authority",
		about: "How many public charging devices for electric vehicles there are in each local authority, counted every quarter by the Department for Transport.",
		summary:
			"Public electric vehicle charger counts by UK local authority.",
	},
	mapName: "EV Charging Points",
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
	load: noCompiledPayload<IndicatorDataset<"electric-vehicle-chargers">>(),
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
		direct: {
			only: true,
			read: ({ odsContent }) =>
				electricVehicleChargerStatisticsPart(odsContent),
		},
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
	ranking: {
		label: "Public chargers",
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
