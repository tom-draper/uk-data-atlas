import type { BoundaryAggregationSpec } from "./ports";
import {
	aggregateAirQuality,
	aggregateBroadband,
	aggregateChildPoverty,
	aggregateClaimantCount,
	aggregateFuelPoverty,
	aggregateHomelessness,
	aggregateSchoolPerformance,
	aggregateSchoolPerformanceGap,
	collectBoundaryRecords,
} from "./numeric";
import { aggregateNHSWaiting } from "./health";
import { aggregatePopulation } from "./population";
import {
	aggregateCrime,
	aggregateCustomDataset,
	aggregateHousePrices,
	aggregateIncome,
	aggregateUnemployment,
} from "./economics";
import {
	aggregateIMD,
	aggregateNIMDM,
	aggregateSIMD,
	aggregateWIMD,
} from "./deprivation";
import {
	aggregateEthnicity,
	aggregateLifeExpectancy,
	aggregateQualifications,
} from "./demographics";
import {
	aggregateBrexit,
	aggregateBrexitConstituencies,
	aggregateGeneralElection,
	aggregateLocalElection,
} from "./elections";
import type { BoundaryCodeScope } from "./ports";

const boundaryAggregation = <T, R>(
	cacheKey: string,
	scope: BoundaryCodeScope,
	aggregate: BoundaryAggregationSpec<T, R>["aggregate"],
): BoundaryAggregationSpec<T, R> => ({ cacheKey, scope, aggregate });

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
> = {
	cacheKey: "custom-dataset",
	scope: "any",
	aggregate: aggregateCustomDataset,
};

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
export const crimeAggregation = boundaryAggregation(
	"crime",
	"localAuthority",
	aggregateCrime,
);
export const incomeAggregation = boundaryAggregation(
	"income",
	"localAuthority",
	aggregateIncome,
);
export const brexitAggregation = boundaryAggregation(
	"brexit",
	"localAuthority",
	aggregateBrexit,
);
export const brexitConstituencyAggregation = boundaryAggregation(
	"brexitConstituency",
	"constituency",
	aggregateBrexitConstituencies,
);
export const lifeExpectancyAggregation = boundaryAggregation(
	"lifeExpectancy",
	"localAuthority",
	aggregateLifeExpectancy,
);
export const simdAggregation = boundaryAggregation(
	"simd",
	"dataZone",
	aggregateSIMD,
);
export const wimdAggregation = boundaryAggregation(
	"wimd",
	"lsoa",
	aggregateWIMD,
);
export const nimdmAggregation = boundaryAggregation(
	"nimdm",
	"superOutputArea",
	aggregateNIMDM,
);
export const imdAggregation = boundaryAggregation("imd", "lsoa", aggregateIMD);
export const qualificationAggregation = boundaryAggregation(
	"qualification",
	"localAuthority",
	aggregateQualifications,
);
export const broadbandAggregation = numericAggregation(
	"broadband",
	"localAuthority",
	aggregateBroadband,
);
export const airQualityAggregation = numericAggregation(
	"airQuality",
	"localAuthority",
	aggregateAirQuality,
);
export const claimantCountAggregation = numericAggregation(
	"claimantCount",
	"localAuthority",
	aggregateClaimantCount,
);
export const childPovertyAggregation = numericAggregation(
	"childPoverty",
	"localAuthority",
	aggregateChildPoverty,
);
export const homelessnessAggregation = numericAggregation(
	"homelessness",
	"localAuthority",
	aggregateHomelessness,
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
export const schoolPerformanceConstituencyAggregation = numericAggregation(
	"schoolPerformanceConstituency",
	"constituency",
	aggregateSchoolPerformance,
);
export const schoolPerformanceGapAggregation = numericAggregation(
	"schoolPerformanceGap",
	"localAuthority",
	aggregateSchoolPerformanceGap,
);
export const nhsWaitingAggregation = boundaryAggregation(
	"nhsWaiting",
	"localAuthority",
	aggregateNHSWaiting,
);
export const unemploymentAggregation = boundaryAggregation(
	"unemployment",
	"localAuthority",
	aggregateUnemployment,
);
