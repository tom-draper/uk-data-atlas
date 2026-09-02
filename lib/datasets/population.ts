import { loadPopulation } from "@/lib/data/population/loader";
import type { PopulationDataset } from "@/lib/types/population";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<PopulationDataset>["calculateStats"] =
	(mapManager, geojson, data, location, datasetId) =>
		mapManager.calculatePopulationStats(geojson, data, location, datasetId);

const density: ChartDefinition<PopulationDataset> = { group: "Demographics", key: "demographics-populationDensity", label: "Population Density [2022]", defaultVisible: true, componentPath: "@/components/demographics/population-density-registry", boundaryType: "ward", calculateStats, year: 2022 };
const age: ChartDefinition<PopulationDataset> = { group: "Demographics", key: "demographics-age", label: "Age Distribution [2022]", defaultVisible: true, componentPath: "@/components/demographics/population-age-registry", boundaryType: "ward", calculateStats, year: 2022 };
const gender: ChartDefinition<PopulationDataset> = { group: "Demographics", key: "demographics-gender", label: "Gender Balance [2022]", defaultVisible: true, componentPath: "@/components/demographics/population-gender-registry", boundaryType: "ward", calculateStats, year: 2022 };
export const populationDefinition: ChartDatasetDefinition<PopulationDataset> = { type: "population", precompiledFile: "population", chart: density, charts: [density, age, gender], source: { name: "Population", source: "Office for National Statistics", sourceUrl: "https://www.ons.gov.uk/", year: "2022", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Ward population estimates." }, precompile: async ({ text }) => loadPopulation(text) };
