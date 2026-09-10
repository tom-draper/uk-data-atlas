import { housePriceDatasetDefinition } from "@/lib/data/catalog/definitions";
import { housePriceAggregation } from "@/lib/helpers/datasetAggregation/specifications";
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
		calculateStats: (aggregator, geojson, data, location, datasetId) =>
			aggregator.aggregate(
				housePriceAggregation,
				geojson,
				data,
				location,
				datasetId,
			),
		year: 2023,
	},
	map: {
		valueFor: (dataset, code, mapOptions) => {
			const ward = dataset.data[code];
			if (!ward) return null;
			return mapOptions.housePrice.measure === "mean"
				? (ward.meanPrices[dataset.year] ?? null)
				: (ward.prices[dataset.year] ?? null);
		},
		colorRange: { min: 80000, max: 500000 },
		legend: {
			min: 0,
			max: 1000000,
			format: (value) => `£${Math.round(value / 1000)}k`,
		},
	},
};
