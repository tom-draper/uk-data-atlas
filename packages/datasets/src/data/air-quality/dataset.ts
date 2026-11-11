import type { AirQualityDataset } from "../../types/airQuality.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { aggregateAirQuality } from "./aggregate.ts";
import { loadAirQuality } from "./loader.ts";

const concentration = (name: string) =>
	({ kind: "decimal", digits: 0, suffix: ` µg/m³ ${name}` }) as const;

export const airQuality = defineDataset<AirQualityDataset>({
	id: "air-quality",
	module: "environment",
	boundary: { type: "localAuthority", year: 2024 },
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
		notes: [],
	},
	load: ({ text }) => loadAirQuality(text),
	statistics: {
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
	display: {
		group: "Environment",
		label: "Air Quality - NO₂ [2024]",
		defaultVisible: true,
		year: 2024,
		component: "@/components/environment/air-quality/AirQualityChart",
		measures: [
			// Modelled background NO2 runs from under 1 µg/m³ in the Highlands to
			// about 33 in the City of London; 95% of authorities are below 18.
			{
				id: "no2",
				label: "NO₂",
				field: "no2Mean",
				colorRange: { min: 2, max: 20 },
				legend: { min: 0, max: 35, format: concentration("NO₂") },
			},
			{
				id: "pm25",
				label: "PM2.5",
				field: "pm25Mean",
				colorRange: { min: 4, max: 12 },
				legend: { min: 0, max: 20, format: concentration("PM2.5") },
			},
			{
				id: "pm10",
				label: "PM10",
				field: "pm10Mean",
				colorRange: { min: 8, max: 25 },
				legend: { min: 0, max: 35, format: concentration("PM10") },
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateAirQuality,
		},
	},
});
