import { populationDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { PopulationDataset } from "@/lib/types/population";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<PopulationDataset>["calculateStats"] =
	(mapManager, geojson, data, location, datasetId) =>
		mapManager.calculatePopulationStats(geojson, data, location, datasetId);

const density: ChartDefinition<PopulationDataset> = { group: "Demographics", key: "demographics-populationDensity", label: "Population Density [2022]", defaultVisible: true, componentPath: "@/components/demographics/population-density-registry", calculateStats, year: 2022 };
const age: ChartDefinition<PopulationDataset> = { group: "Demographics", key: "demographics-age", label: "Age Distribution [2022]", defaultVisible: true, componentPath: "@/components/demographics/population-age-registry", calculateStats, year: 2022 };
const gender: ChartDefinition<PopulationDataset> = { group: "Demographics", key: "demographics-gender", label: "Gender Balance [2022]", defaultVisible: true, componentPath: "@/components/demographics/population-gender-registry", calculateStats, year: 2022 };
export const populationDefinition: ChartDatasetDefinition<PopulationDataset> = {
	...populationDatasetDefinition,
	chart: density,
	charts: [density, age, gender],
};
