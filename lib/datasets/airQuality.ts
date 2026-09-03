import { airQualityDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { AirQualityDataset } from "@/lib/types/airQuality";
import type { ChartDatasetDefinition } from "./types";

export const airQualityDefinition: ChartDatasetDefinition<AirQualityDataset> = {
	...airQualityDatasetDefinition,
	chart: {
		group: "Environment",
		key: "environment-airQuality",
		label: "Air Quality - NO₂ [2022]",
		defaultVisible: true,
		componentPath: "@/components/environment/air-quality/AirQualityChart",
		calculateStats: (m, g, d, l, id) =>
			m.calculateAirQualityStats(g, d, l, id),
		year: 2022,
	},
	map: {
		valueKey: "no2Mean",
		colorRange: { min: 5, max: 35 },
		legend: { min: 0, max: 60, format: (v) => `${v.toFixed(0)} µg/m³ NO₂` },
	},
};
