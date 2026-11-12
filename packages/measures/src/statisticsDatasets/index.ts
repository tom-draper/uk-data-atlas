import {
	DATASET_DECLARATIONS,
	type DatasetModule,
} from "@uk-data-atlas/datasets";
import { statisticsOf } from "@uk-data-atlas/datasets";
import type { DeclaredDataset } from "../declaredStatistics.ts";
import { HOUSE_PRICE } from "./economy.ts";

/** Catalogue datasets stored as statistics rows, by manifest type. */
/** Statistics declarations not yet moved into a dataset declaration. */
const LEGACY_STATISTICS_DATASETS: readonly DeclaredDataset[] = [HOUSE_PRICE];

/** Catalogue datasets stored as statistics rows, by manifest type. */
export const STATISTICS_DATASETS: readonly DeclaredDataset[] = [
	...LEGACY_STATISTICS_DATASETS,
	...DATASET_DECLARATIONS.map(statisticsOf),
];

/**
 * Manifest types not yet stored as statistics rows, and why. The build
 * refuses a type that is in neither list.
 */
export const UNSTORED_DATASETS: Readonly<
	Record<string, { reason: string; module: DatasetModule }>
> = {};
