import { ghgEmissionsDatasetDefinition } from "@/lib/data/catalog/definitions";
import { ghgEmissionsAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { GhgEmissionsDataset } from "@/lib/types/ghgEmissions";
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
					default:
						return area?.perPersonTCO2e ?? null;
				}
			},
			sourceMode: (_dataset, mapOptions) =>
				`ghgEmissions:${mapOptions.ghgEmissions.measure}`,
			colorRange: { min: 3, max: 12 },
			legend: {
				min: 0,
				max: 20,
				format: (value) => `${value.toFixed(0)} t`,
			},
		},
	};
