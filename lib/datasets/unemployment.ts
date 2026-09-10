import { unemploymentDatasetDefinition } from "@/lib/data/catalog/definitions";
import { unemploymentAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { UnemploymentDataset } from "@/lib/types/unemployment";
import type { ChartDatasetDefinition } from "./types";

export const unemploymentDefinition: ChartDatasetDefinition<UnemploymentDataset> =
	{
		...unemploymentDatasetDefinition,
		chart: {
			group: "Economics",
			key: "economics-unemployment",
			label: "Unemployment Rate [2021]",
			defaultVisible: true,
			componentPath:
				"@/components/economics/unemployment/UnemploymentChart",
			calculateStats: (
				aggregator,
				geojson,
				data,
				location,
				datasetId,
				dataset,
			) =>
				dataset
					? aggregator.aggregate(
							unemploymentAggregation,
							geojson,
							dataset,
							location,
							datasetId,
						)
					: null,
			year: 2021,
		},
		map: {
			valueFor: (dataset, code) =>
				dataset.data[code]?.rates[dataset.latestYear] ?? null,
			colorRange: { min: 2.2, max: 6.8 },
			legend: {
				min: 2.2,
				max: 6.8,
				format: (value) => `${value.toFixed(1)}%`,
			},
		},
	};
