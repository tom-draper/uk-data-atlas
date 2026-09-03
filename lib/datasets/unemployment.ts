import { unemploymentDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { UnemploymentDataset } from "@/lib/types/unemployment";
import type { ChartDatasetDefinition } from "./types";

export const unemploymentDefinition: ChartDatasetDefinition<UnemploymentDataset> = {
	...unemploymentDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-unemployment",
		label: "Unemployment Rate [2021]",
		defaultVisible: true,
		componentPath: "@/components/economics/unemployment/UnemploymentChart",
		boundaryType: "localAuthority",
		calculateStats: (mapManager, geojson, data, location, datasetId, dataset) =>
			dataset ? mapManager.calculateUnemploymentStats(geojson, dataset, location, datasetId) : null,
		year: 2021,
	},
	map: {
		valueFor: (dataset, code) => dataset.data[code]?.rates[dataset.latestYear] ?? null,
		colorRange: { min: 0, max: 15 },
		legend: { min: 0, max: 15, format: (value) => `${value.toFixed(1)}% unemployed` },
	},
};
