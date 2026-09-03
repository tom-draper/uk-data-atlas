import { fuelPovertyDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { FuelPovertyDataset } from "@/lib/types/fuelPoverty";
import type { ChartDatasetDefinition } from "./types";

export const fuelPovertyDefinition: ChartDatasetDefinition<FuelPovertyDataset> =
	{
		...fuelPovertyDatasetDefinition,
		chart: {
			group: "Economics",
			key: "economics-fuelPoverty",
			label: "Fuel Poverty [2024]",
			defaultVisible: true,
			componentPath:
				"@/components/economics/fuel-poverty/FuelPovertyChart",
			calculateStats: (aggregator, geojson, data, location, datasetId) =>
				aggregator.calculateFuelPovertyStats(
					geojson,
					data,
					location,
					datasetId,
				),
			year: 2024,
		},
		map: {
			valueKey: "fuelPovertyRate",
			colorRange: { min: 5, max: 15 },
			legend: {
				min: 0,
				max: 30,
				format: (value) => `${value.toFixed(0)}% households`,
			},
		},
	};
