import {
  renderAgeDistribution,
  renderGender,
  renderPopulationDensity,
} from "@/lib/helpers/mapRendering";
import { populationDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { PopulationDataset } from "@/lib/types/population";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<PopulationDataset>["calculateStats"] = (
  mapManager,
  geojson,
  data,
  location,
  datasetId,
) => mapManager.calculatePopulationStats(geojson, data, location, datasetId);

const density: ChartDefinition<PopulationDataset> = {
  group: "Demographics",
  key: "demographics-populationDensity",
  label: "Population Density [2022]",
  defaultVisible: true,
  componentPath: "@/components/demographics/population-density-registry",
  calculateStats,
  year: 2022,
};
const age: ChartDefinition<PopulationDataset> = {
  group: "Demographics",
  key: "demographics-age",
  label: "Age Distribution [2022]",
  defaultVisible: true,
  componentPath: "@/components/demographics/population-age-registry",
  calculateStats,
  year: 2022,
};
const gender: ChartDefinition<PopulationDataset> = {
  group: "Demographics",
  key: "demographics-gender",
  label: "Gender Balance [2022]",
  defaultVisible: true,
  componentPath: "@/components/demographics/population-gender-registry",
  calculateStats,
  year: 2022,
};
export const populationDefinition: ChartDatasetDefinition<PopulationDataset> = {
  ...populationDatasetDefinition,
  chart: density,
  charts: [density, age, gender],
  legendKind: "population",
  mapRenderer: {
    // Population backs three charts, so the active view picks between them.
    // A link that names no view gets the dataset's primary chart, density.
    getOptions: (activeViz, mapOptions) => {
      switch (activeViz.view) {
        case "age":
          return mapOptions.ageDistribution;
        case "gender":
          return mapOptions.gender;
        default:
          return mapOptions.populationDensity;
      }
    },
    render: ({ map, geojson, dataset, mapOptions, activeViz }) => {
      switch (activeViz.view) {
        case "age":
          renderAgeDistribution(map, geojson, dataset, mapOptions);
          return;
        case "gender":
          renderGender(map, geojson, dataset, mapOptions);
          return;
        default:
          renderPopulationDensity(map, geojson, dataset, mapOptions);
      }
    },
  },
};
