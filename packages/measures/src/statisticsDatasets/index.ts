import {
	DATASET_DECLARATIONS,
	type DatasetModule,
} from "@uk-data-atlas/datasets";
import { statisticsOf } from "@uk-data-atlas/datasets";
import type { DeclaredDataset } from "../declaredStatistics.ts";
import {
	CAR_AVAILABILITY,
	ETHNICITY,
	QUALIFICATION,
	TRAVEL_TO_WORK,
} from "./census.ts";
import { HOUSE_PRICE, INCOME } from "./economy.ts";
import { SCHOOL_PERFORMANCE } from "./services.ts";
import { LIFE_EXPECTANCY_LATEST, POPULATION_WARDS } from "./people.ts";

/** Catalogue datasets stored as statistics rows, by manifest type. */
/** Statistics declarations not yet moved into a dataset declaration. */
const LEGACY_STATISTICS_DATASETS: readonly DeclaredDataset[] = [
	CAR_AVAILABILITY,
	QUALIFICATION,
	TRAVEL_TO_WORK,
	ETHNICITY,
	INCOME,
	HOUSE_PRICE,
	SCHOOL_PERFORMANCE,
	POPULATION_WARDS,
	LIFE_EXPECTANCY_LATEST,
];

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
