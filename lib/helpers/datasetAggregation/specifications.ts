import type { BoundaryAggregationSpec } from "./ports";
import {
	aggregateFuelPoverty,
	aggregateSchoolPerformance,
	collectBoundaryRecords,
} from "./numeric";
import { aggregateIndicator, averageIndicator } from "./indicator";
import { aggregatePopulation } from "./population";
import { aggregateCustomDataset, aggregateHousePrices } from "./economics";
import {} from "@uk-data-atlas/datasets";
import { aggregateEthnicity, aggregateLifeExpectancy } from "./demographics";
import {
	aggregateBrexit,
	aggregateBrexitConstituencies,
	aggregateGeneralElection,
	aggregateLocalElection,
} from "./elections";
import { createBoundaryAggregationSpec, type BoundaryCodeScope } from "./ports";

const boundaryAggregation = <T, R>(
	cacheKey: string,
	scope: BoundaryCodeScope,
	aggregate: BoundaryAggregationSpec<T, R>["aggregate"],
): BoundaryAggregationSpec<T, R> =>
	createBoundaryAggregationSpec(cacheKey, scope, aggregate);

const numericAggregation = <T, R>(
	cacheKey: string,
	scope: BoundaryCodeScope,
	aggregate: (records: T[]) => R | null,
): BoundaryAggregationSpec<Record<string, T>, R | null> =>
	boundaryAggregation(cacheKey, scope, (features, codeProp, data) =>
		aggregate(collectBoundaryRecords(features, data, codeProp)),
	);

/** Aggregation owned by imported custom boundary datasets. */
export const customDatasetAggregation: BoundaryAggregationSpec<
	Record<string, number>,
	ReturnType<typeof aggregateCustomDataset>
> = createBoundaryAggregationSpec(
	"custom-dataset",
	"any",
	aggregateCustomDataset,
);

export const localElectionAggregation = boundaryAggregation(
	"local-election",
	"ward",
	aggregateLocalElection,
);
export const generalElectionAggregation = boundaryAggregation(
	"general-election",
	"constituency",
	aggregateGeneralElection,
);
export const populationAggregation = boundaryAggregation(
	"population-ward",
	"ward",
	aggregatePopulation,
);
export const ethnicityAggregation = boundaryAggregation(
	"ethnicity",
	"localAuthority",
	aggregateEthnicity,
);
export const housePriceAggregation = boundaryAggregation(
	"house-price",
	"ward",
	aggregateHousePrices,
);
export const brexitAggregation = boundaryAggregation(
	"brexit",
	"localAuthority",
	aggregateBrexit,
);
export const brexitConstituencyAggregation = boundaryAggregation(
	"brexit-constituency",
	"constituency",
	aggregateBrexitConstituencies,
);
export const lifeExpectancyAggregation = boundaryAggregation(
	"lifeExpectancy",
	"localAuthority",
	aggregateLifeExpectancy,
);
export const fuelPovertyAggregation = numericAggregation(
	"fuelPoverty",
	"lsoa",
	aggregateFuelPoverty,
);
export const schoolPerformanceAggregation = numericAggregation(
	"schoolPerformance",
	"localAuthority",
	aggregateSchoolPerformance,
);
export const indicatorAggregation = numericAggregation(
	"indicator",
	"any",
	aggregateIndicator,
);
export const averageIndicatorAggregation = numericAggregation(
	"average-indicator",
	"any",
	averageIndicator,
);
