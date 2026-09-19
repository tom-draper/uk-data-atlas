import { businessActivityDatasetDefinition } from "@/lib/data/catalog/definitions";
import { indicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
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
		componentPath: "@/components/IndicatorChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(indicatorAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 0, max: 50_000 },
		legend: {
			min: 0,
			max: 100_000,
			format: (v) => v.toLocaleString("en-GB"),
		},
	},
};
