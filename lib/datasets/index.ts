import { SCALAR_DATASET_DEFINITIONS } from "./generated";
import type { ScalarDataset } from "./generated";

export { SCALAR_DATASET_DEFINITIONS } from "./generated";
export type { DatasetSource, ScalarDatasetDefinition, ScalarDatasetMap } from "./types";
export type { ScalarDatasetType } from "./generated";

export function getScalarDatasetDefinition(type: string) {
	return SCALAR_DATASET_DEFINITIONS.find((definition) => definition.type === type);
}

export function isScalarDataset<T extends { type: string }>(
	dataset: T,
): dataset is T & ScalarDataset {
	return getScalarDatasetDefinition(dataset.type) !== undefined;
}
