import { loadHousePrice } from "@/lib/data/house-price/loader";
import type { HousePriceDataset } from "@/lib/types/housePrice";
import type { ChartDatasetDefinition } from "./types";

export const housePriceDefinition: ChartDatasetDefinition<HousePriceDataset> = {
	type: "housePrice",
	precompiledFile: "house-price",
	chart: {
		group: "Economics",
		key: "economics-housePrice",
		label: "House Price [2023]",
		defaultVisible: true,
		componentPath: "@/components/economics/house-price/HousePriceChart",
		boundaryType: "ward",
		calculateStats: (mapManager, geojson, data, location, datasetId) =>
			mapManager.calculateHousePriceStats(geojson, data, location, datasetId),
		year: 2023,
	},
	source: {
		name: "House Price",
		source: "Office for National Statistics",
		sourceUrl: "https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/medianpricepaidbywardhpssadataset37",
		year: "1995-2023",
		licence: "Open Government Licence v3.0",
		licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Median house price paid by ward for England and Wales.",
	},
	map: {
		valueFor: (dataset, code) => dataset.data[code]?.prices[dataset.year] ?? null,
		colorRange: { min: 100000, max: 600000 },
		legend: { min: 0, max: 1000000, format: (value) => `£${Math.round(value / 1000)}k median price` },
	},
	precompile: async ({ text }) => loadHousePrice(text),
};
