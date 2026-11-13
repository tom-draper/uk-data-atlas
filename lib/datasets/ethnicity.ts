import { renderEthnicity } from "@/lib/helpers/mapRendering";
import { ethnicityAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { definitionOf, ethnicity } from "@uk-data-atlas/datasets";
import type { EthnicityDataset } from "@uk-data-atlas/datasets";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<EthnicityDataset>["calculateStats"] = (
	mapManager,
	geojson,
	data,
	location,
	datasetId,
) =>
	mapManager.aggregate(
		ethnicityAggregation,
		geojson,
		data,
		location,
		datasetId,
	);

export const ethnicityDefinition: ChartDatasetDefinition<EthnicityDataset> = {
	...definitionOf(ethnicity),
	chart: {
		topic: "ethnicity-and-identity",
		key: "demographics-ethnicity",
		label: "Ethnicity [2021]",
		componentPath:
			"@/components/datasets/population/ethnicity-and-identity/ethnicity/EthnicityRegistry",
		calculateStats,
		year: 2021,
	},
	legendAggregation: { calculateStats },
	legendKind: "ethnicity",
	mapRenderer: {
		getOptions: (_activeViz, mapOptions) => mapOptions.ethnicity,
		render: ({ map, geojson, dataset, mapOptions, isDark }) =>
			renderEthnicity(map, geojson, dataset, mapOptions, isDark),
	},
};
