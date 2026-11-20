import type { AirQualityDataset } from "../../../types/airQuality.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { aggregateAirQuality } from "../../../data/air-quality/aggregate.ts";
import { airQualityStatisticsParts } from "../../../data/air-quality/source.ts";

const concentration = (name: string) =>
	({ kind: "decimal", digits: 0, suffix: ` µg/m³ ${name}` }) as const;

export const airQuality = defineDataset<AirQualityDataset>({
	id: "air-quality",
	topic: "air-quality",
	boundary: { type: "localAuthority", year: 2024 },
	guide: {
		title: "Air Quality",
		about: "Modelled levels of the main air pollutants, nitrogen dioxide and fine particulate matter (PM2.5 and PM10), averaged over each local authority. These pollutants are linked to heart and lung disease.",
		summary:
			"Average background levels of nitrogen dioxide and particulate matter (PM10 and PM2.5) in each UK local authority, from Defra's modelled pollution maps.",
	},
	mapName: "Air Pollution (NO₂)",
	source: {
		name: "Air Quality",
		publisher: "Department for Environment, Food and Rural Affairs",
		sourceUrl: "https://uk-air.defra.gov.uk/data/pcm-data",
		year: "2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department for Environment, Food and Rural Affairs. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Modelled 2024 annual mean background NO2, PM10 and PM2.5 by local authority, averaged from Defra's 1x1 km PCM maps, with Defra's population-weighted PM2.5.",
		cadence: "annual",
		notes: [
			"Background concentrations are modelled for 1x1 km squares away from the immediate influence of roads and industrial sources, so they are lower than roadside measurements.",
			"PCM maps from https://uk-air.defra.gov.uk/data/pcm-data. Each cell is assigned to the December 2024 authority containing its centre; a coastal cell whose centre lies offshore of the generalised coastline belongs to none.",
		],
	},
	statistics: {
		direct: {
			only: true,
			read: ({ text }) => airQualityStatisticsParts(text),
		},
		payload: {
			parts: yearParts("air-quality", "localAuthority", 2024),
			code: "ladCode",
		},
		name: "ladName",
		measures: [
			measure(
				"air-quality-grid-cells",
				"Air quality grid cells",
				"grid cells",
				"count",
				"sum",
				"1 km grid cells of the background pollution maps averaged for the area.",
			),
			measure(
				"background-concentration",
				"Background concentration",
				"micrograms per cubic metre",
				"mean",
				"weighted_mean",
				"Modelled annual mean background concentration, averaged over the area's 1 km grid cells.",
				{ weight: "air-quality-grid-cells" },
			),
			measure(
				"pm25-population-weighted",
				"Population-weighted PM2.5",
				"micrograms per cubic metre",
				"mean",
				"weighted_mean",
				"Annual mean PM2.5 concentration weighted by where people live.",
			),
			measure(
				"pm25-population-weighted-anthropogenic",
				"Population-weighted anthropogenic PM2.5",
				"micrograms per cubic metre",
				"mean",
				"weighted_mean",
				"Human-made part of the annual mean PM2.5 concentration, weighted by where people live.",
			),
		],
		dimensions: [
			{
				slug: "pollutant",
				label: "Pollutant",
				members: [
					{ key: "no2", label: "Nitrogen dioxide" },
					{ key: "pm25", label: "PM2.5" },
					{ key: "pm10", label: "PM10" },
				],
			},
		],
		// The compiler averages the 1 km grid over each area, so the means and
		// their cell counts are derived; the population-weighted figures are
		// published per area.
		fields: [
			...["no2", "pm25", "pm10"].map((pollutant) => ({
				path: `${pollutant}Mean`,
				measure: "background-concentration",
				members: { pollutant },
				statusOfAll: "derived" as const,
			})),
			{
				path: "gridCells",
				measure: "air-quality-grid-cells",
				statusOfAll: "derived",
			},
			{
				path: "pm25PopulationWeighted",
				measure: "pm25-population-weighted",
			},
			{
				path: "pm25PopulationWeightedAnthropogenic",
				measure: "pm25-population-weighted-anthropogenic",
			},
		],
	},
	catalogue: {
		kind: "indicators",
		period: "2024",
		codes: "authorities",
		coverageNote:
			"Every local authority in all four UK nations has a value.",
		indicators: [
			{
				id: "air-quality-grid-cells",
				label: "PCM grid cells",
				field: "gridCells",
				valueKind: "count",
				unit: "1x1 km grid cells",
				aggregation: "sum",
				notes: [
					"How many of Defra's 1x1 km PCM cells have their centre in the authority, roughly its land area in square kilometres. It is the weight for the area means.",
				],
				measure: "air-quality-grid-cells",
				status: "derived",
			},
			{
				id: "no2-background-mean",
				label: "Background nitrogen dioxide, area mean",
				field: "no2Mean",
				valueKind: "quantity",
				unit: "µg/m³",
				aggregation: {
					kind: "weighted-mean",
					weight: {
						description:
							"The authority's count of 1x1 km grid cells, over which its mean is taken, so a weighted mean is the area mean over the combined authorities.",
						datasetField: "gridCells",
						measureId: "air-quality-grid-cells",
					},
					available: true,
				},
				notes: [
					"The mean of Defra's modelled 2024 annual mean background nitrogen dioxide (NO2) concentration over the 1x1 km cells whose centres lie in the authority: an average across its area, not weighted by where people live.",
				],
				measure: "background-concentration",
				members: { pollutant: "no2" },
				status: "derived",
			},
			{
				id: "pm10-background-mean",
				label: "Background PM10, area mean",
				field: "pm10Mean",
				valueKind: "quantity",
				unit: "µg/m³",
				aggregation: {
					kind: "weighted-mean",
					weight: {
						description:
							"The authority's count of 1x1 km grid cells, over which its mean is taken, so a weighted mean is the area mean over the combined authorities.",
						datasetField: "gridCells",
						measureId: "air-quality-grid-cells",
					},
					available: true,
				},
				notes: [
					"The mean of Defra's modelled 2024 annual mean background PM10, in gravimetric units, concentration over the 1x1 km cells whose centres lie in the authority: an average across its area, not weighted by where people live.",
				],
				measure: "background-concentration",
				members: { pollutant: "pm10" },
				status: "derived",
			},
			{
				id: "pm25-background-mean",
				label: "Background PM2.5, area mean",
				field: "pm25Mean",
				valueKind: "quantity",
				unit: "µg/m³",
				aggregation: {
					kind: "weighted-mean",
					weight: {
						description:
							"The authority's count of 1x1 km grid cells, over which its mean is taken, so a weighted mean is the area mean over the combined authorities.",
						datasetField: "gridCells",
						measureId: "air-quality-grid-cells",
					},
					available: true,
				},
				notes: [
					"The mean of Defra's modelled 2024 annual mean background PM2.5 concentration over the 1x1 km cells whose centres lie in the authority: an average across its area, not weighted by where people live.",
				],
				measure: "background-concentration",
				members: { pollutant: "pm25" },
				status: "derived",
			},
			{
				id: "pm25-population-weighted",
				label: "Population-weighted PM2.5",
				field: "pm25PopulationWeighted",
				valueKind: "quantity",
				unit: "µg/m³",
				aggregation: {
					kind: "weighted-mean",
					weight: {
						description:
							"The resident population Defra weighted each authority's concentrations by, which it does not publish with the table.",
						datasetField: "population",
					},
				},
				notes: [
					"Defra's published population-weighted annual mean PM2.5 for 2024, total of anthropogenic and non-anthropogenic, which Defra advises for estimating the health burden of long-term exposure.",
				],
				measure: "pm25-population-weighted",
			},
			{
				id: "pm25-population-weighted-anthropogenic",
				label: "Population-weighted anthropogenic PM2.5",
				field: "pm25PopulationWeightedAnthropogenic",
				valueKind: "quantity",
				unit: "µg/m³",
				aggregation: {
					kind: "weighted-mean",
					weight: {
						description:
							"The resident population Defra weighted each authority's concentrations by, which it does not publish with the table.",
						datasetField: "population",
					},
				},
				notes: [
					"The anthropogenic part of Defra's population-weighted PM2.5 for 2024, excluding natural sources such as sea salt.",
				],
				measure: "pm25-population-weighted-anthropogenic",
			},
		],
	},
	display: {
		label: "Air Quality - NO₂ [2024]",
		year: 2024,
		card: {
			heading: "Air Quality",
			coverage: "United Kingdom",
			source: "Defra. Pollution Climate Mapping background maps, 2024. uk-air.defra.gov.uk",
			pills: [
				{ label: "PM2.5", field: "pm25Mean", unit: "µg/m³", digits: 1 },
				{ label: "PM10", field: "pm10Mean", unit: "µg/m³", digits: 1 },
			],
			appearance: { layout: "pills", accent: "#22c55e" },
		},
		measures: [
			// Modelled background NO2 runs from under 1 µg/m³ in the Highlands to
			// about 33 in the City of London; 95% of authorities are below 18.
			{
				id: "no2",
				label: "NO₂",
				field: "no2Mean",
				colorRange: { min: 2, max: 20 },
				legend: { min: 0, max: 35, format: concentration("NO₂") },
				card: { unit: "µg/m³", digits: 1, maximum: 35 },
			},
			{
				id: "pm25",
				label: "PM2.5",
				field: "pm25Mean",
				colorRange: { min: 4, max: 12 },
				legend: { min: 0, max: 20, format: concentration("PM2.5") },
				card: { unit: "µg/m³", digits: 1, maximum: 35 },
			},
			{
				id: "pm10",
				label: "PM10",
				field: "pm10Mean",
				colorRange: { min: 8, max: 25 },
				legend: { min: 0, max: 35, format: concentration("PM10") },
				card: { unit: "µg/m³", digits: 1, maximum: 35 },
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateAirQuality,
		},
	},
});

export const airQualitySeries = () =>
	airQuality
		.statistics!.dimensions!.find(
			(dimension) => dimension.slug === "pollutant",
		)!
		.members!.map(({ code, key }) => {
			const member = code ?? key;
			return {
				id: `${member}-background-mean`,
				measure: "background-concentration",
				dimensions: { pollutant: member },
			};
		});
