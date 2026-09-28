import { housingAffordabilityDatasetDefinition } from "@/lib/data/catalog/definitions";
import { averageIndicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { ChartDatasetDefinition } from "./types";
export const housingAffordabilityDefinition: ChartDatasetDefinition<
	IndicatorDataset<"housingAffordability">
> = {
	...housingAffordabilityDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-housingAffordability",
		label: "Housing Affordability [2025]",
		defaultVisible: true,
		componentPath: "@/components/IndicatorChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(averageIndicatorAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 4, max: 14 },
		legend: { min: 0, max: 20, format: (v) => `${v.toFixed(0)}×` },
	},
};
