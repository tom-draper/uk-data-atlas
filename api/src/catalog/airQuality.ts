import { type Indicator, publishIndicators } from "./indicators";
import type { CatalogManifest, CompiledMeasure } from "./manifest";

/**
 * Defra's Pollution Climate Mapping (PCM) model of background air
 * pollution in 2024.
 *
 * The area means are compiled by the website's build from Defra's 1x1 km
 * maps, so they are served as derived; each authority's count of cells is
 * served beside them as the weight that combines them exactly. Defra's own
 * population-weighted PM2.5 is served as published. Both are on the April
 * 2023 authorities, which every 2024 release shares, and must name all 361.
 */
export const compileAirQuality = (
	manifest: CatalogManifest,
	airQualityPath: string,
	populationCodes: Set<string>,
): CompiledMeasure[] => {
	const areaMean = (
		id: string,
		label: string,
		field: string,
		pollutant: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "quantity",
		unit: "µg/m³",
		status: "derived",
		aggregation: {
			kind: "intensive",
			operation: "weighted-mean",
			weight: {
				description:
					"The authority's count of 1x1 km grid cells, over which its mean is taken, so a weighted mean is the area mean over the combined authorities.",
				datasetField: "gridCells",
				measureId: "air-quality-grid-cells",
			},
			available: true,
		},
		notes: [
			`The mean of Defra's modelled 2024 annual mean background ${pollutant} concentration over the 1x1 km cells whose centres lie in the authority: an average across its area, not weighted by where people live.`,
		],
	});
	const populationWeightedPm25 = (
		id: string,
		label: string,
		field: string,
		note: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "quantity",
		unit: "µg/m³",
		aggregation: {
			kind: "intensive",
			operation: "weighted-mean",
			weight: {
				description:
					"The resident population Defra weighted each authority's concentrations by, which it does not publish with the table.",
				datasetField: "population",
			},
			available: false,
		},
		notes: [note],
	});
	return publishIndicators(manifest, {
		datasetId: "air-quality",
		path: airQualityPath,
		boundaryYear: 2024,
		period: "2024",
		expectedCodes: [...populationCodes],
		coverageNote:
			"Every local authority in all four UK nations has a value.",
		notes: [
			"Background concentrations are modelled for 1x1 km squares away from the immediate influence of roads and industrial sources, so they are lower than roadside measurements.",
			"PCM maps from https://uk-air.defra.gov.uk/data/pcm-data. Each cell is assigned to the December 2024 authority containing its centre; a coastal cell whose centre lies offshore of the generalised coastline belongs to none.",
		],
		indicators: [
			{
				id: "air-quality-grid-cells",
				label: "PCM grid cells",
				field: "gridCells",
				valueKind: "count",
				unit: "1x1 km grid cells",
				status: "derived",
				aggregation: {
					kind: "extensive",
					operation: "sum",
					available: true,
				},
				notes: [
					"How many of Defra's 1x1 km PCM cells have their centre in the authority, roughly its land area in square kilometres. It is the weight for the area means.",
				],
			},
			areaMean(
				"no2-background-mean",
				"Background nitrogen dioxide, area mean",
				"no2Mean",
				"nitrogen dioxide (NO2)",
			),
			areaMean(
				"pm10-background-mean",
				"Background PM10, area mean",
				"pm10Mean",
				"PM10, in gravimetric units,",
			),
			areaMean(
				"pm25-background-mean",
				"Background PM2.5, area mean",
				"pm25Mean",
				"PM2.5",
			),
			populationWeightedPm25(
				"pm25-population-weighted",
				"Population-weighted PM2.5",
				"pm25PopulationWeighted",
				"Defra's published population-weighted annual mean PM2.5 for 2024, total of anthropogenic and non-anthropogenic, which Defra advises for estimating the health burden of long-term exposure.",
			),
			populationWeightedPm25(
				"pm25-population-weighted-anthropogenic",
				"Population-weighted anthropogenic PM2.5",
				"pm25PopulationWeightedAnthropogenic",
				"The anthropogenic part of Defra's population-weighted PM2.5 for 2024, excluding natural sources such as sea salt.",
			),
		],
	});
};
