import { homelessnessDatasetDefinition } from "@/lib/data/catalog/definitions";
import { homelessnessAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type {
	AggregatedHomelessnessData,
	HomelessnessDataset,
} from "@/lib/types/homelessness";
import { formatCompactCount } from "@/lib/helpers/formatCount";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

export const homelessnessDefinition: ChartDatasetDefinition<HomelessnessDataset> =
	{
		...homelessnessDatasetDefinition,
		chart: {
			group: "Economics",
			key: "economics-homelessness",
			label: "Homelessness [2026]",
			defaultVisible: true,
			componentPath: "@/components/ValueCard",
			card: defineValueCard<
				HomelessnessDataset,
				AggregatedHomelessnessData
			>({
				heading: "Homelessness",
				headingTitle: "Homelessness: temporary accommodation",
				coverage: "England",
				source: "Ministry of Housing, Communities and Local Government. Statutory homelessness statistics. gov.uk",
				unit: "per 1k households",
				digits: 1,
				maximum: 15,
				value: (stats) => stats.householdsPerThousand,
				secondary: (stats) =>
					`${formatCompactCount(stats.householdsInTemporaryAccommodation)} in TA`,
			}),
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
