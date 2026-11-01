import { housingTenureDatasetDefinition } from "@uk-data-atlas/datasets/data/catalog/definitions/housingTenure";
import type {
	IndicatorDataset,
	IndicatorRecord,
} from "@uk-data-atlas/datasets/types/indicator";
import { createBoundaryAggregationSpec } from "@/lib/helpers/datasetAggregation/ports";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import { TENURE_MEASURES } from "@/lib/helpers/housingTenureMeasures";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";
export function sumHousingTenure(records: IndicatorRecord[]) {
	if (!records.length) return null;
	const metrics: Record<string, number> = {};
	for (const record of records)
		for (const [key, count] of Object.entries(record.metrics ?? {}))
			metrics[key] = (metrics[key] ?? 0) + count;
	return {
		code: "",
		name: "",
		value: metrics.total > 0 ? (metrics.owned / metrics.total) * 100 : 0,
		metrics,
	};
}
const aggregation = createBoundaryAggregationSpec(
	"housing-tenure",
	"lsoa",
	(features, codeProperty, data: Record<string, IndicatorRecord>) =>
		sumHousingTenure(collectBoundaryRecords(features, data, codeProperty)),
);
function percentage(record: IndicatorRecord | undefined, measure: string) {
	const total = record?.metrics?.total;
	const count = record?.metrics?.[measure];
	return total && count !== undefined ? (count / total) * 100 : null;
}
const card = (measure: (typeof TENURE_MEASURES)[number]["value"]) =>
	defineValueCard<
		IndicatorDataset<"housingTenure">,
		IndicatorRecord,
		IndicatorRecord
	>({
		heading: "Housing tenure",
		coverage: "England & Wales",
		source: "ONS. Census 2021, TS054. LSOA 2021 boundaries.",
		unit: "% households",
		digits: 1,
		maximum: 100,
		hoverRecord: true,
		aggregate: (record) => record,
		value: (record) => percentage(record, measure),
		secondary: () =>
			TENURE_MEASURES.find((option) => option.value === measure)?.label,
	});
export const housingTenureDefinition: ChartDatasetDefinition<
	IndicatorDataset<"housingTenure">
> = {
	...housingTenureDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-housingTenure",
		label: "Housing Tenure [2021]",
		defaultVisible: false,
		componentPath: "@/components/ValueCard",
		card: card("owned"),
		cardForOptions: (options) => card(options.housingTenure.measure),
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(aggregation, g, d, l, id),
		year: 2021,
	},
	map: {
		valueFor: (dataset, code, options) =>
			percentage(dataset.data[code], options.housingTenure.measure),
		sourceMode: (_dataset, options) =>
			`housingTenure:${options.housingTenure.measure}`,
		colorRange: { min: 0, max: 100 },
		legend: {
			min: 0,
			max: 100,
			format: (value) => `${value.toFixed(1)}% households`,
		},
	},
};
