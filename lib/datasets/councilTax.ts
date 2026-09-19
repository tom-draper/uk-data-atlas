import { councilTaxDatasetDefinition } from "@/lib/data/catalog/definitions";
import { indicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { ChartDatasetDefinition } from "./types";
export const councilTaxDefinition: ChartDatasetDefinition<
	IndicatorDataset<"councilTax">
> = {
	...councilTaxDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-councilTax",
		label: "Council Tax [2026]",
		defaultVisible: true,
		componentPath: "@/components/IndicatorChart",
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(indicatorAggregation, g, d, l, id),
		year: 2026,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 1_000, max: 3_000 },
		legend: { min: 0, max: 4_000, format: (v) => `£${v.toFixed(0)}` },
	},
};
