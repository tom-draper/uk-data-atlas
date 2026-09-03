import { renderEthnicity } from "@/lib/helpers/mapRendering";
import { ethnicityDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { EthnicityDataset } from "@/lib/types/ethnicity";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<EthnicityDataset>["calculateStats"] = (
	mapManager,
	geojson,
	data,
	location,
	datasetId,
) => mapManager.calculateEthnicityStats(geojson, data, location, datasetId);

export const ethnicityDefinition: ChartDatasetDefinition<EthnicityDataset> = {
	...ethnicityDatasetDefinition,
	chart: {
		group: "Demographics",
		key: "demographics-ethnicity",
		label: "Ethnicity [2021]",
		defaultVisible: true,
		componentPath: "@/components/demographics/ethnicity-registry",
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
