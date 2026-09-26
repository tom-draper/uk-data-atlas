import { localGovernmentFinanceDatasetDefinition } from "@/lib/data/catalog/definitions";
import { indicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { ChartDatasetDefinition } from "./types";
export const localGovernmentFinanceDefinition: ChartDatasetDefinition<
	IndicatorDataset<"localGovernmentFinance">
> = {
	...localGovernmentFinanceDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-localGovernmentFinance",
		label: "Education Services Spending [2026]",
		defaultVisible: false,
		componentPath: "@/components/IndicatorChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(indicatorAggregation, g, d, l, id),
		year: 2026,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 0, max: 300_000 },
		legend: {
			min: 0,
			max: 1_000_000,
			format: (v) => `£${v.toLocaleString("en-GB")}k`,
		},
	},
};
