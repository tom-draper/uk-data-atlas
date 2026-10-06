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
			label: "Historic Unemployment Rate [2021]",
			defaultVisible: false,
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
			valueFor: (dataset, code, mapOptions) => {
				const area = dataset.data[code];
				return mapOptions.unemployment.measure === "count"
					? (area?.levels?.[dataset.latestYear] ?? null)
					: (area?.rates[dataset.latestYear] ?? null);
			},
			sourceMode: (_dataset, mapOptions) =>
				`unemployment:${mapOptions.unemployment.measure}`,
			colorRange: { min: 2.2, max: 6.8 },
			legend: {
				min: 2.2,
				max: 6.8,
				format: (value) => `${value.toFixed(1)}%`,
			},
		},
	};
