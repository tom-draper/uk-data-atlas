import { homelessnessDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { HomelessnessDataset } from "@/lib/types/homelessness";
import type { ChartDatasetDefinition } from "./types";

export const homelessnessDefinition: ChartDatasetDefinition<HomelessnessDataset> = {
	...homelessnessDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-homelessness",
		label: "Homelessness [2026]",
		defaultVisible: true,
		componentPath: "@/components/economics/homelessness/HomelessnessChart",
		boundaryType: "localAuthority",
		calculateStats: (mapManager, geojson, data, location, datasetId) =>
			mapManager.calculateHomelessnessStats(geojson, data, location, datasetId),
		year: 2026,
	},
	map: {
		valueKey: "householdsPerThousand",
		colorRange: { min: 1, max: 12 },
		legend: { min: 0, max: 20, format: (value) => `${value.toFixed(1)} per 1k households` },
	},
};
