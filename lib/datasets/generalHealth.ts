import { generalHealthDatasetDefinition } from "@uk-data-atlas/datasets/data/catalog/definitions/generalHealth";
import type {
	IndicatorDataset,
	IndicatorRecord,
} from "@uk-data-atlas/datasets/types/indicator";
import { createBoundaryAggregationSpec } from "@/lib/helpers/datasetAggregation/ports";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import { HEALTH_MEASURES } from "@/lib/helpers/generalHealthMeasures";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";
export function sumGeneralHealth(records: IndicatorRecord[]) {
	if (!records.length) return null;
	const metrics: Record<string, number> = {};
	for (const record of records)
		for (const [key, count] of Object.entries(record.metrics ?? {}))
			metrics[key] = (metrics[key] ?? 0) + count;
	return {
		code: "",
		name: "",
		value:
			metrics.total > 0 ? (metrics.goodHealth / metrics.total) * 100 : 0,
		metrics,
	};
}
const aggregation = createBoundaryAggregationSpec(
	"general-health",
	"lsoa",
	(features, codeProperty, data: Record<string, IndicatorRecord>) =>
		sumGeneralHealth(collectBoundaryRecords(features, data, codeProperty)),
);
function percentage(record: IndicatorRecord | undefined, measure: string) {
	const total = record?.metrics?.total;
	const count = record?.metrics?.[measure];
	return total && count !== undefined ? (count / total) * 100 : null;
}
const card = (measure: (typeof HEALTH_MEASURES)[number]["value"]) =>
	defineValueCard<
		IndicatorDataset<"generalHealth">,
		IndicatorRecord,
		IndicatorRecord
	>({
		heading: "General health",
		coverage: "England & Wales",
		source: "ONS. Census 2021, TS037. LSOA 2021 boundaries.",
		unit: "% residents",
		digits: 1,
		maximum: 100,
		hoverRecord: true,
		aggregate: (record) => record,
		value: (record) => percentage(record, measure),
		secondary: () =>
			HEALTH_MEASURES.find((option) => option.value === measure)?.label,
	});
export const generalHealthDefinition: ChartDatasetDefinition<
	IndicatorDataset<"generalHealth">
> = {
	...generalHealthDatasetDefinition,
	chart: {
		group: "Health",
		key: "health-generalHealth",
		label: "General health [2021]",
		defaultVisible: false,
		componentPath: "@/components/ValueCard",
		card: card("goodHealth"),
		cardForOptions: (options) => card(options.generalHealth.measure),
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(aggregation, g, d, l, id),
		year: 2021,
	},
	map: {
		valueFor: (dataset, code, options) =>
			percentage(dataset.data[code], options.generalHealth.measure),
		sourceMode: (_dataset, options) =>
			`generalHealth:${options.generalHealth.measure}`,
		colorRange: { min: 0, max: 100 },
		legend: {
			min: 0,
			max: 100,
			format: (value) => `${value.toFixed(1)}% residents`,
		},
	},
};
