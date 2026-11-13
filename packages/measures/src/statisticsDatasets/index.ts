import {
	DATASET_DECLARATIONS,
	type DatasetTheme,
} from "@uk-data-atlas/datasets";
import { statisticsOf } from "@uk-data-atlas/datasets";
import type { DeclaredDataset } from "../declaredStatistics.ts";

/** Catalogue datasets stored as statistics rows, by manifest type. */
export const STATISTICS_DATASETS: readonly DeclaredDataset[] =
	DATASET_DECLARATIONS.map(statisticsOf);

/**
 * Manifest types not yet stored as statistics rows, and why. The build
 * refuses a type that is in neither list.
 */
export const UNSTORED_DATASETS: Readonly<
	Record<string, { reason: string; module: DatasetTheme }>
> = {};
