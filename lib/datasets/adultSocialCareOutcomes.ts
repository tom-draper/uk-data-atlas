import { adultSocialCareOutcomesDatasetDefinition } from "@/lib/data/catalog/definitions";
import { averageIndicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { ChartDatasetDefinition } from "./types";
export const adultSocialCareOutcomesDefinition: ChartDatasetDefinition<
	IndicatorDataset<"adultSocialCareOutcomes">
> = {
	...adultSocialCareOutcomesDatasetDefinition,
	chart: {
		group: "Health",
		key: "health-adultSocialCareOutcomes",
		label: "Social Care Quality of Life [2025]",
		defaultVisible: true,
		componentPath: "@/components/IndicatorChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(averageIndicatorAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 15, max: 22 },
		legend: { min: 0, max: 24, format: (v) => v.toFixed(1) },
	},
};
