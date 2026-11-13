import { fuelPovertyAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { definitionOf, fuelPoverty } from "@uk-data-atlas/datasets";
import type { FuelPovertyDataset } from "@uk-data-atlas/datasets";
import type { ChartDatasetDefinition } from "./types";

export const fuelPovertyDefinition: ChartDatasetDefinition<FuelPovertyDataset> =
	{
		...definitionOf(fuelPoverty),
		chart: {
			topic: "poverty",
			key: "economics-fuelPoverty",
			label: "Fuel Poverty [2024]",
			componentPath:
				"@/components/datasets/society/poverty/fuel-poverty/FuelPovertyChart",
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
					options["fuel-poverty"].measure === "count"
						? "fuelPoorHouseholdCount"
						: "fuelPovertyRate"
				] ?? null,
			sourceMode: (_dataset, options) =>
				`fuelPoverty:${options["fuel-poverty"].measure}`,
			colorRange: { min: 5, max: 15 },
			legend: {
				min: 0,
				max: 30,
				bounds: (options) => ({
					min: 0,
					max:
						options["fuel-poverty"].measure === "count" ? 1000 : 30,
				}),
				format: (value, options) =>
					options["fuel-poverty"].measure === "count"
						? `${Math.round(value).toLocaleString("en-GB")} households`
						: `${value.toFixed(0)}% households`,
			},
		},
	};
