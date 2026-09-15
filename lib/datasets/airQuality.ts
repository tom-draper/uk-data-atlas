import { airQualityDatasetDefinition } from "@/lib/data/catalog/definitions";
import { airQualityAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { AirQualityDataset } from "@/lib/types/airQuality";
import type { ChartDatasetDefinition } from "./types";

export const airQualityDefinition: ChartDatasetDefinition<AirQualityDataset> = {
	...airQualityDatasetDefinition,
	chart: {
		group: "Environment",
		key: "environment-airQuality",
		label: "Air Quality - NO₂ [2024]",
		defaultVisible: true,
		componentPath: "@/components/environment/air-quality/AirQualityChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(airQualityAggregation, g, d, l, id),
		year: 2024,
	},
	map: {
		valueKey: "no2Mean",
		// Modelled background NO2 runs from under 1 µg/m³ in the Highlands to
		// about 33 in the City of London; 95% of authorities are below 18.
		colorRange: { min: 2, max: 20 },
		legend: { min: 0, max: 35, format: (v) => `${v.toFixed(0)} µg/m³ NO₂` },
	},
};
