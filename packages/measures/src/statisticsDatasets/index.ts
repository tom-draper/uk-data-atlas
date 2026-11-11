import {
	DATASET_DECLARATIONS,
	type DatasetModule,
} from "@uk-data-atlas/datasets";
import { statisticsOf } from "@uk-data-atlas/datasets";
import type { DeclaredDataset } from "../declaredStatistics.ts";
import { GENERAL_ELECTION, LOCAL_ELECTION } from "./elections.ts";
import {
	CAR_AVAILABILITY,
	ETHNICITY,
	GENERAL_HEALTH,
	HOUSING_TENURE,
	QUALIFICATION,
	TRAVEL_TO_WORK,
} from "./census.ts";
import {
	HOUSE_PRICE,
	INCOME,
	REGIONAL_GDP_ITL3,
	UNEMPLOYMENT,
	WORKPLACE_INCOME,
} from "./economy.ts";
import {
	ELECTRICITY_CONSUMPTION,
	GAS_CONSUMPTION,
	WASTE,
} from "./environment.ts";
import {
	PLANNING_APPLICATIONS,
	PUBLIC_HEALTH,
	PUPIL_ABSENCE,
	SCHOOL_PERFORMANCE,
} from "./services.ts";
import {
	BREXIT,
	BREXIT_CONSTITUENCY,
	IMD,
	LIFE_EXPECTANCY_LATEST,
	NIMDM,
	POPULATION_WARDS,
	SIMD,
	WIMD,
} from "./people.ts";

/** Catalogue datasets stored as statistics rows, by manifest type. */
/** Statistics declarations not yet moved into a dataset declaration. */
const LEGACY_STATISTICS_DATASETS: readonly DeclaredDataset[] = [
	CAR_AVAILABILITY,
	QUALIFICATION,
	TRAVEL_TO_WORK,
	ETHNICITY,
	GENERAL_HEALTH,
	HOUSING_TENURE,
	INCOME,
	WORKPLACE_INCOME,
	UNEMPLOYMENT,
	REGIONAL_GDP_ITL3,
	HOUSE_PRICE,
	ELECTRICITY_CONSUMPTION,
	GAS_CONSUMPTION,
	WASTE,
	PLANNING_APPLICATIONS,
	PUBLIC_HEALTH,
	PUPIL_ABSENCE,
	SCHOOL_PERFORMANCE,
	POPULATION_WARDS,
	LIFE_EXPECTANCY_LATEST,
	IMD,
	WIMD,
	SIMD,
	NIMDM,
	BREXIT,
	BREXIT_CONSTITUENCY,
	LOCAL_ELECTION,
	GENERAL_ELECTION,
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
