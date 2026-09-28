import { planningApplicationsDatasetDefinition } from "@/lib/data/catalog/definitions";
import { averageIndicatorAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { IndicatorDataset } from "@/lib/types/indicator";
import { indicatorCard } from "./indicatorCard";
import type { ChartDatasetDefinition } from "./types";
export const planningApplicationsDefinition: ChartDatasetDefinition<
	IndicatorDataset<"planningApplications">
> = {
	...planningApplicationsDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-planningApplications",
		label: "Planning Applications [2026 Q1]",
		defaultVisible: true,
		componentPath: "@/components/ValueCard",
		card: indicatorCard({
			heading: "Planning applications",
			unit: "received",
			maximum: 3_000,
		}),
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(averageIndicatorAggregation, g, d, l, id),
		year: 2026,
	},
	map: {
		valueKey: "value",
		colorRange: { min: 0, max: 1_500 },
		legend: {
			min: 0,
			max: 3_000,
			format: (v) => v.toLocaleString("en-GB"),
		},
	},
};
