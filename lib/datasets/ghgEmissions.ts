import { ghgEmissionsDatasetDefinition } from "@/lib/data/catalog/definitions";
import { ghgEmissionsAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { GhgEmissionsDataset } from "@uk-data-atlas/datasets/types/ghgEmissions";
import type { ChartDatasetDefinition } from "./types";

export const ghgEmissionsDefinition: ChartDatasetDefinition<GhgEmissionsDataset> =
	{
		...ghgEmissionsDatasetDefinition,
		chart: {
			group: "Environment",
			key: "environment-ghgEmissions",
			label: "Greenhouse Gas Emissions [2024]",
			defaultVisible: true,
			componentPath:
				"@/components/environment/ghg-emissions/GHGEmissionsChart",
			calculateStats: (aggregator, geojson, data, location, datasetId) =>
				aggregator.aggregate(
					ghgEmissionsAggregation,
					geojson,
					data,
					location,
					datasetId,
				),
			year: 2024,
		},
		map: {
			valueFor: (dataset, code, mapOptions) => {
				const area = dataset.data[code];
				switch (mapOptions.ghgEmissions.measure) {
					case "total":
						return area?.totalKtCO2e ?? null;
					case "excludingLandUse":
						return area?.excludingLandUseKtCO2e ?? null;
					case "perPerson":
						return area?.perPersonTCO2e ?? null;
					default:
						return area?.[mapOptions.ghgEmissions.measure] ?? null;
				}
			},
			sourceMode: (_dataset, mapOptions) =>
				`ghgEmissions:${mapOptions.ghgEmissions.measure}`,
			colorRange: { min: 3, max: 12 },
			legend: {
				min: 0,
				max: 20,
				bounds: (options) => ({
					min: options.ghgEmissions.measure === "landUse" ? -2000 : 0,
					max:
						options.ghgEmissions.measure === "perPerson"
							? 20
							: 6000,
				}),
				format: (value, options) =>
					options.ghgEmissions.measure === "perPerson"
						? `${value.toFixed(1)} t CO₂e per person`
						: `${value.toFixed(0)} kt CO₂e`,
			},
		},
	};
