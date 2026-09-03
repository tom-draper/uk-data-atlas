import { childPovertyDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { ChildPovertyDataset } from "@/lib/types/childPoverty";
import type { ChartDatasetDefinition } from "./types";

export const childPovertyDefinition: ChartDatasetDefinition<ChildPovertyDataset> = {
	...childPovertyDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-childPoverty",
		label: "Child Poverty [2025]",
		defaultVisible: true,
		componentPath: "@/components/economics/child-poverty/ChildPovertyChart",
		boundaryType: "localAuthority",
		calculateStats: (mapManager, geojson, data, location, datasetId) =>
			mapManager.calculateChildPovertyStats(geojson, data, location, datasetId),
		year: 2025,
	},
	map: {
		valueKey: "childPovertyRate",
		colorRange: { min: 10, max: 35 },
		legend: { min: 0, max: 60, format: (value) => `${value.toFixed(0)}% children` },
	},
};
