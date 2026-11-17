import { renderPopulationView } from "@/lib/helpers/mapRendering";
import { populationViewOptions } from "@/lib/helpers/mapRendering/population";
import { declaredMapView } from "./declared";
import { populationAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { definitionOf, population } from "@uk-data-atlas/datasets";
import type { PopulationDataset } from "@uk-data-atlas/datasets";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<PopulationDataset>["calculateStats"] = (
	mapManager,
	geojson,
	data,
	location,
	datasetId,
) =>
	mapManager.aggregate(
		populationAggregation,
		geojson,
		data,
		location,
		datasetId,
	);

const density: ChartDefinition<PopulationDataset> = {
	topic: "population-estimates",
	key: "demographics-populationDensity",
	label: "Population Density [2022]",
	view: "density",
	componentPath:
		"@/components/datasets/population/population-estimates/population/PopulationDensityRegistry",
	calculateStats,
	year: 2022,
};
const age: ChartDefinition<PopulationDataset> = {
	topic: "population-estimates",
	key: "demographics-age",
	label: "Age Distribution [2022]",
	view: "age",
	componentPath:
		"@/components/datasets/population/population-estimates/population/PopulationAgeRegistry",
	calculateStats,
	year: 2022,
};
const gender: ChartDefinition<PopulationDataset> = {
	topic: "population-estimates",
	key: "demographics-gender",
	label: "Gender Balance [2022]",
	view: "gender",
	componentPath:
		"@/components/datasets/population/population-estimates/population/PopulationGenderRegistry",
	calculateStats,
	year: 2022,
};
export const populationDefinition: ChartDatasetDefinition<PopulationDataset> = {
	...definitionOf(population),
	chart: density,
	charts: [density, age, gender],
	mapRenderer: {
		// Population backs three charts, so the active view picks between them.
		// A link that names no view gets the dataset's primary chart, density.
		getOptions: (activeViz, mapOptions) =>
			populationViewOptions(
				declaredMapView("population", activeViz.view)!,
				mapOptions,
			),
		render: ({ map, geojson, dataset, mapOptions, activeViz }) =>
			renderPopulationView(
				map,
				geojson,
				dataset,
				mapOptions,
				declaredMapView("population", activeViz.view)!,
			),
	},
};
