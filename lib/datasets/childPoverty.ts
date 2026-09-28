import { childPovertyDatasetDefinition } from "@/lib/data/catalog/definitions";
import { childPovertyAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type {
	AggregatedChildPovertyData,
	ChildPovertyDataset,
} from "@/lib/types/childPoverty";
import { formatCompactCount } from "@/lib/helpers/formatCount";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

export const childPovertyDefinition: ChartDatasetDefinition<ChildPovertyDataset> =
	{
		...childPovertyDatasetDefinition,
		chart: {
			group: "Economics",
			key: "economics-childPoverty",
			label: "Child Poverty [2025]",
			defaultVisible: true,
			componentPath: "@/components/ValueCard",
			card: defineValueCard<
				ChildPovertyDataset,
				AggregatedChildPovertyData
			>({
				heading: "Child Poverty",
				source: "DWP. Children in relative low-income families, before housing costs.",
				unit: "% children",
				digits: 1,
				// Rates above 40% are uncommon; cap the bar there to retain contrast.
				maximum: 40,
				value: (stats) => stats.childPovertyRate,
				secondary: (stats) =>
					`${formatCompactCount(stats.childCount)} affected`,
			}),
			calculateStats: (aggregator, geojson, data, location, datasetId) =>
				aggregator.aggregate(
					childPovertyAggregation,
					geojson,
					data,
					location,
					datasetId,
				),
			year: 2025,
		},
		map: {
			valueKey: "childPovertyRate",
			colorRange: { min: 10, max: 35 },
			legend: {
				min: 0,
				max: 60,
				format: (value) => `${value.toFixed(0)}%`,
			},
		},
	};
