import { businessActivityDatasetDefinition } from "@/lib/data/catalog/definitions";
import { averageIndicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import { indicatorCard } from "./indicatorCard";
import type { ChartDatasetDefinition } from "./types";
export const businessActivityDefinition: ChartDatasetDefinition<
	IndicatorDataset<"businessActivity">
> = {
	...businessActivityDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-businessActivity",
		label: "Businesses [2025]",
		defaultVisible: true,
		componentPath: "@/components/ValueCard",
		card: indicatorCard({
			heading: "Businesses",
			unit: "enterprises",
			maximum: 100_000,
		}),
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(averageIndicatorAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueFor: (dataset, code, mapOptions) => {
			const record = dataset.data[code];
			return mapOptions.businessActivity.measure === "perPopulation"
				? (record?.metrics?.per100kPopulation ?? null)
				: (record?.value ?? null);
		},
		sourceMode: (_dataset, mapOptions) =>
			`businessActivity:${mapOptions.businessActivity.measure}`,
		colorRange: { min: 0, max: 50_000 },
		legend: {
			min: 0,
			max: 100_000,
			format: (v) => v.toLocaleString("en-GB"),
		},
	},
};
