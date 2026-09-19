import { netAdditionalDwellingsDatasetDefinition } from "@/lib/data/catalog/definitions";
import { indicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { ChartDatasetDefinition } from "./types";
export const netAdditionalDwellingsDefinition: ChartDatasetDefinition<
	IndicatorDataset<"netAdditionalDwellings">
> = {
	...netAdditionalDwellingsDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-netAdditionalDwellings",
		label: "Net Additional Dwellings [2025]",
		defaultVisible: true,
		componentPath: "@/components/IndicatorChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(indicatorAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 0, max: 5_000 },
		legend: {
			min: 0,
			max: 10_000,
			format: (v) => v.toLocaleString("en-GB"),
		},
	},
};
