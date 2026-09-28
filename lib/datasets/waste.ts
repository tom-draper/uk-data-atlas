import { wasteDatasetDefinition } from "@/lib/data/catalog/definitions";
import { indicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import { indicatorCard } from "./indicatorCard";
import type { ChartDatasetDefinition } from "./types";
export const wasteDefinition: ChartDatasetDefinition<
	IndicatorDataset<"waste">
> = {
	...wasteDatasetDefinition,
	chart: {
		group: "Environment",
		key: "environment-waste",
		label: "Collected Waste [2025]",
		defaultVisible: true,
		componentPath: "@/components/ValueCard",
		card: indicatorCard({
			heading: "Collected waste",
			unit: "tonnes",
			maximum: 500_000,
		}),
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(indicatorAggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 0, max: 200_000 },
		legend: {
			min: 0,
			max: 500_000,
			format: (v) => `${v.toLocaleString("en-GB")} t`,
		},
	},
};
