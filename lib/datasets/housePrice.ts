import { housePriceDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { HousePriceDataset } from "@/lib/types/housePrice";
import type { ChartDatasetDefinition } from "./types";

export const housePriceDefinition: ChartDatasetDefinition<HousePriceDataset> = {
	...housePriceDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-housePrice",
		label: "House Price [2023]",
		defaultVisible: true,
		componentPath: "@/components/economics/house-price/HousePriceChart",
		calculateStats: (mapManager, geojson, data, location, datasetId) =>
			mapManager.calculateHousePriceStats(geojson, data, location, datasetId),
		year: 2023,
	},
	map: {
		valueFor: (dataset, code) => dataset.data[code]?.prices[dataset.year] ?? null,
		colorRange: { min: 100000, max: 600000 },
		legend: { min: 0, max: 1000000, format: (value) => `£${Math.round(value / 1000)}k median price` },
	},
};
