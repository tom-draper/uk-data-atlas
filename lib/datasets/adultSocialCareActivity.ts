import { adultSocialCareActivityDatasetDefinition } from "@/lib/data/catalog/definitions";
import { averageIndicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { ChartDatasetDefinition } from "./types";
export const adultSocialCareActivityDefinition: ChartDatasetDefinition<
	IndicatorDataset<"adultSocialCareActivity">
> = {
	...adultSocialCareActivityDatasetDefinition,
	chart: {
		group: "Health",
		key: "health-adultSocialCareActivity",
		label: "Long-term Support [2025]",
		defaultVisible: true,
		componentPath: "@/components/IndicatorChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(averageIndicatorAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 0, max: 20_000 },
		legend: {
			min: 0,
			max: 50_000,
			format: (v) => v.toLocaleString("en-GB"),
		},
	},
};
