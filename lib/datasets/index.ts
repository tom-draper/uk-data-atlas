import { CHART_DATASET_DEFINITIONS } from "./generated";
import type { ChartDataset, ChartDatasetType } from "./generated";

export { CHART_DATASET_DEFINITIONS } from "./generated";
export type {
	ChartDatasetDefinition,
	ChartDatasetLegendAggregation,
	ChartDatasetLegendKind,
	ChartDatasetMap,
	ChartDatasetMapRenderer,
	ChartPresentation,
	ChartPresentationRegistry,
} from "./types";
export type { ChartDatasetType } from "./generated";
export type { ChartDataset } from "./generated";

/** Public dataset identifiers are kebab-case, independently of TypeScript keys. */
export function datasetSlug(datasetType: string) {
	return datasetType.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** Resolve a public dataset identifier to the registry's internal key. */
export function getChartDatasetTypeForSlug(
	slug: string,
): ChartDatasetType | null {
	const definition = CHART_DATASET_DEFINITIONS.find(
		(candidate) => datasetSlug(candidate.type) === slug,
	);
	return (definition?.type as ChartDatasetType | undefined) ?? null;
}

export function getChartDatasetDefinition(type: string) {
	return CHART_DATASET_DEFINITIONS.find(
		(definition) => definition.type === type,
	);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Validate the shared outer contract emitted by every compiled chart dataset. */
export function isChartDatasetPayload(
	value: unknown,
	expectedType?: string,
): value is ChartDataset {
	if (!isRecord(value) || typeof value.type !== "string") return false;
	if (expectedType !== undefined && value.type !== expectedType) return false;
	const definition = getChartDatasetDefinition(value.type);
	return (
		definition !== undefined &&
		typeof value.id === "string" &&
		typeof value.year === "number" &&
		typeof value.boundaryYear === "number" &&
		value.boundaryType === definition.boundaryType &&
		isRecord(value.data)
	);
}

export function isChartDataset<T extends { type: string }>(
	dataset: T,
): dataset is T & ChartDataset {
	return getChartDatasetDefinition(dataset.type) !== undefined;
}
