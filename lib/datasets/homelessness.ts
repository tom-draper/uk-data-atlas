import { homelessnessDatasetDefinition } from "@/lib/data/catalog/definitions";
import { homelessnessAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { HomelessnessDataset } from "@/lib/types/homelessness";
import type { ChartDatasetDefinition } from "./types";

export const homelessnessDefinition: ChartDatasetDefinition<HomelessnessDataset> =
	{
		...homelessnessDatasetDefinition,
		chart: {
			group: "Economics",
			key: "economics-homelessness",
			label: "Homelessness [2026]",
			defaultVisible: true,
			componentPath:
				"@/components/economics/homelessness/HomelessnessChart",
			calculateStats: (aggregator, geojson, data, location, datasetId) =>
				aggregator.aggregate(
					homelessnessAggregation,
					geojson,
					data,
					location,
					datasetId,
				),
			year: 2026,
		},
		map: {
			valueKey: "householdsPerThousand",
			colorRange: { min: 1, max: 12 },
			legend: {
				min: 0,
				max: 20,
				format: (value) => `${value.toFixed(1)} per 1k households`,
			},
		},
	};
