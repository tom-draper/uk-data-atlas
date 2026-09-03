import { CHART_DATASET_DEFINITIONS } from "./generated";
import type { ChartDataset } from "./generated";

export { CHART_DATASET_DEFINITIONS } from "./generated";
export type {
	ChartDatasetDefinition,
	ChartDatasetLegendAggregation,
	ChartDatasetLegendKind,
	ChartDatasetMap,
	ChartDatasetMapRenderer,
} from "./types";
export type { ChartDatasetType } from "./generated";

export function getChartDatasetDefinition(type: string) {
	return CHART_DATASET_DEFINITIONS.find(
		(definition) => definition.type === type,
	);
}

export function isChartDataset<T extends { type: string }>(
	dataset: T,
): dataset is T & ChartDataset {
	return getChartDatasetDefinition(dataset.type) !== undefined;
}
