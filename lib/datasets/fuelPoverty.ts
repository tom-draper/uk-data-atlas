import { fuelPovertyDatasetDefinition } from "@/lib/data/catalog/definitions";
import { fuelPovertyAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { FuelPovertyDataset } from "@uk-data-atlas/datasets/types/fuelPoverty";
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
				aggregator.aggregate(
					fuelPovertyAggregation,
					geojson,
					data,
					location,
					datasetId,
				),
			year: 2024,
		},
		map: {
			valueFor: (dataset, code, options) =>
				dataset.data[code]?.[
					options.fuelPoverty.measure === "count"
						? "fuelPoorHouseholdCount"
						: "fuelPovertyRate"
				] ?? null,
			sourceMode: (_dataset, options) =>
				`fuelPoverty:${options.fuelPoverty.measure}`,
			colorRange: { min: 5, max: 15 },
			legend: {
				min: 0,
				max: 30,
				bounds: (options) => ({
					min: 0,
					max: options.fuelPoverty.measure === "count" ? 1000 : 30,
				}),
				format: (value, options) =>
					options.fuelPoverty.measure === "count"
						? `${Math.round(value).toLocaleString("en-GB")} households`
						: `${value.toFixed(0)}% households`,
			},
		},
	};
