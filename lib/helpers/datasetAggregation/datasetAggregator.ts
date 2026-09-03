// Boundary and cache adapter for dataset aggregation.
import {
	BoundaryGeojson,
	Features,
	PropertyKeys,
	LocalElectionDataset,
	GeneralElectionDataset,
	PopulationDataset,
	HousePriceWardData,
	CrimeDataset,
	EthnicityDataset,
	BrexitLADDataset,
	BrexitConstituencyDataset,
} from "@lib/types";
import type {
	AggregationCache,
	BoundaryCodeDetector,
	BoundaryCodeScope,
} from "./ports";
import {
	aggregateAirQuality,
	aggregateBroadband,
	aggregateChildPoverty,
	aggregateClaimantCount,
	aggregateFuelPoverty,
	aggregateHomelessness,
	aggregateSchoolPerformance,
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
import { IncomeDataset } from "@/lib/types/income";
import { IMDDataset, AggregatedIMDData } from "@/lib/types/imd";
import { SIMDDataset, AggregatedSIMDData } from "@/lib/types/simd";
import { WIMDDataset, AggregatedWIMDData } from "@/lib/types/wimd";
import { NIMDMDataset, AggregatedNIMDMData } from "@/lib/types/nimdm";
import {
	LifeExpectancyDataset,
	AggregatedLifeExpectancyData,
} from "@/lib/types/lifeExpectancy";
import {
	QualificationDataset,
	AggregatedQualificationData,
} from "@/lib/types/qualification";
import {
	BroadbandDataset,
	AggregatedBroadbandData,
} from "@/lib/types/broadband";
import {
	AirQualityDataset,
	AggregatedAirQualityData,
} from "@/lib/types/airQuality";
import {
	ClaimantCountDataset,
	AggregatedClaimantCountData,
} from "@/lib/types/claimantCount";
import {
	SchoolPerformanceDataset,
	AggregatedSchoolPerformanceData,
} from "@/lib/types/schoolPerformance";
import {
	NHSWaitingDataset,
	AggregatedNHSWaitingData,
} from "@/lib/types/nhsWaiting";
import {
	UnemploymentDataset,
	AggregatedUnemploymentData,
} from "@/lib/types/unemployment";
import {
	ChildPovertyDataset,
	AggregatedChildPovertyData,
} from "@/lib/types/childPoverty";
import {
	HomelessnessDataset,
	AggregatedHomelessnessData,
} from "@/lib/types/homelessness";
import {
	FuelPovertyDataset,
	AggregatedFuelPovertyData,
} from "@/lib/types/fuelPoverty";

/** Aggregates dataset records against the currently loaded boundary geometry. */
export class DatasetAggregator {
	constructor(
		private propertyDetector: BoundaryCodeDetector,
		private cache: AggregationCache,
	) {}

	// Wraps a computation in the shared stats cache. Caching the computed value
	// (including null) means empty-coverage results aren't recomputed each update.
	private cached<R>(cacheKey: string, compute: () => R): R {
		const cached = this.cache.get(cacheKey);
		if (cached !== undefined) return cached as R;
		const result = compute();
		this.cache.set(cacheKey, result);
		return result;
	}

	/**
	 * Aggregates over the boundaries currently loaded, keyed by the location and
	 * dataset the caller is looking at. Every dataset resolves its area code
	 * property the same way, so only the geography and the reducer differ.
	 */
	private byBoundary<R>(
		key: string,
		scope: BoundaryCodeScope,
		geojson: BoundaryGeojson,
		location: string | null,
		datasetId: string | null,
		aggregate: (features: Features, codeProp: PropertyKeys) => R,
	): R {
		return this.cached(`${key}-${location}-${datasetId}`, () =>
			aggregate(
				geojson.features,
				this.propertyDetector.detect(scope, geojson.features),
			),
		);
	}

	private calculateNumericStats<T, R>(
		cachePrefix: string,
		geojson: BoundaryGeojson,
		data: Record<string, T>,
		location: string | null,
		datasetId: string | null,
		codeLevel: "localAuthority" | "lsoa",
		aggregate: (records: T[]) => R | null,
	): R | null {
		return this.byBoundary(
			cachePrefix,
			codeLevel,
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregate(collectBoundaryRecords(features, data, codeProp)),
		);
	}

	calculateLocalElectionStats(
		geojson: BoundaryGeojson,
		wardData: LocalElectionDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"local-election",
			"ward",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateLocalElection(features, codeProp, wardData),
		);
	}

	calculateGeneralElectionStats(
		geojson: BoundaryGeojson,
		constituencyData: GeneralElectionDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"general-election",
			"constituency",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateGeneralElection(features, codeProp, constituencyData),
		);
	}

	calculatePopulationStats(
		geojson: BoundaryGeojson,
		populationData: PopulationDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"population",
			"ward",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregatePopulation(features, codeProp, populationData),
		);
	}

	calculateEthnicityStats(
		geojson: BoundaryGeojson,
		localAuthorityData: EthnicityDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"ethnicity",
			"localAuthority",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateEthnicity(features, codeProp, localAuthorityData),
		);
	}

	calculateHousePriceStats(
		geojson: BoundaryGeojson,
		wardData: Record<string, HousePriceWardData>,
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"house-price",
			"ward",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateHousePrices(features, codeProp, wardData),
		);
	}

	calculateCrimeStats(
		geojson: BoundaryGeojson,
		crimeData: CrimeDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"crime",
			"localAuthority",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateCrime(features, codeProp, crimeData),
		);
	}

	calculateIncomeStats(
		geojson: BoundaryGeojson,
		incomeData: IncomeDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"income",
			"localAuthority",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateIncome(features, codeProp, incomeData),
		);
	}

	calculateBrexitStats(
		geojson: BoundaryGeojson,
		brexitData: BrexitLADDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"brexit",
			"localAuthority",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateBrexit(features, codeProp, brexitData),
		);
	}

	calculateBrexitConstituencyStats(
		geojson: BoundaryGeojson,
		constituencyData: BrexitConstituencyDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"brexitConstituency",
			"constituency",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateBrexitConstituencies(
					features,
					codeProp,
					constituencyData,
				),
		);
	}

	calculateCustomDatasetStats(
		geojson: BoundaryGeojson,
		data: Record<string, number>,
		location: string | null,
		datasetId: string | null,
	) {
		return this.byBoundary(
			"custom-dataset",
			"any",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateCustomDataset(features, codeProp, data),
		);
	}

	calculateLifeExpectancyStats(
		geojson: BoundaryGeojson,
		leData: LifeExpectancyDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedLifeExpectancyData {
		return this.byBoundary(
			"lifeExpectancy",
			"localAuthority",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateLifeExpectancy(features, codeProp, leData),
		);
	}

	calculateSIMDStats(
		geojson: BoundaryGeojson,
		simdData: SIMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedSIMDData | null {
		return this.byBoundary(
			"simd",
			"dataZone",
			geojson,
			location,
			datasetId,
			(features, codeProp) => aggregateSIMD(features, codeProp, simdData),
		);
	}

	calculateWIMDStats(
		geojson: BoundaryGeojson,
		wimdData: WIMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedWIMDData | null {
		return this.byBoundary(
			"wimd",
			"lsoa",
			geojson,
			location,
			datasetId,
			(features, codeProp) => aggregateWIMD(features, codeProp, wimdData),
		);
	}

	calculateNIMDMStats(
		geojson: BoundaryGeojson,
		nimdmData: NIMDMDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedNIMDMData | null {
		return this.byBoundary(
			"nimdm",
			"superOutputArea",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateNIMDM(features, codeProp, nimdmData),
		);
	}

	calculateIMDStats(
		geojson: BoundaryGeojson,
		imdData: IMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedIMDData {
		return this.byBoundary(
			"imd",
			"lsoa",
			geojson,
			location,
			datasetId,
			(features, codeProp) => aggregateIMD(features, codeProp, imdData),
		);
	}

	calculateQualificationStats(
		geojson: BoundaryGeojson,
		qualData: QualificationDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedQualificationData {
		return this.byBoundary(
			"qualification",
			"localAuthority",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateQualifications(features, codeProp, qualData),
		);
	}

	calculateBroadbandStats(
		geojson: BoundaryGeojson,
		broadbandData: BroadbandDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedBroadbandData | null {
		return this.calculateNumericStats(
			"broadband",
			geojson,
			broadbandData,
			location,
			datasetId,
			"localAuthority",
			aggregateBroadband,
		);
	}

	calculateAirQualityStats(
		geojson: BoundaryGeojson,
		airQualityData: AirQualityDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedAirQualityData | null {
		return this.calculateNumericStats(
			"airQuality",
			geojson,
			airQualityData,
			location,
			datasetId,
			"localAuthority",
			aggregateAirQuality,
		);
	}

	calculateClaimantCountStats(
		geojson: BoundaryGeojson,
		data: ClaimantCountDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedClaimantCountData | null {
		return this.calculateNumericStats(
			"claimantCount",
			geojson,
			data,
			location,
			datasetId,
			"localAuthority",
			aggregateClaimantCount,
		);
	}

	calculateChildPovertyStats(
		geojson: BoundaryGeojson,
		data: ChildPovertyDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedChildPovertyData | null {
		return this.calculateNumericStats(
			"childPoverty",
			geojson,
			data,
			location,
			datasetId,
			"localAuthority",
			aggregateChildPoverty,
		);
	}

	calculateHomelessnessStats(
		geojson: BoundaryGeojson,
		data: HomelessnessDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedHomelessnessData | null {
		return this.calculateNumericStats(
			"homelessness",
			geojson,
			data,
			location,
			datasetId,
			"localAuthority",
			aggregateHomelessness,
		);
	}

	calculateFuelPovertyStats(
		geojson: BoundaryGeojson,
		data: FuelPovertyDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedFuelPovertyData | null {
		return this.calculateNumericStats(
			"fuelPoverty",
			geojson,
			data,
			location,
			datasetId,
			"lsoa",
			aggregateFuelPoverty,
		);
	}

	calculateSchoolPerformanceStats(
		geojson: BoundaryGeojson,
		data: SchoolPerformanceDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedSchoolPerformanceData | null {
		return this.calculateNumericStats(
			"schoolPerformance",
			geojson,
			data,
			location,
			datasetId,
			"localAuthority",
			aggregateSchoolPerformance,
		);
	}

	calculateNHSWaitingStats(
		geojson: BoundaryGeojson,
		dataset: NHSWaitingDataset,
		location: string | null,
		datasetId: string | null,
	): AggregatedNHSWaitingData | null {
		return this.byBoundary(
			"nhsWaiting",
			"localAuthority",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateNHSWaiting(features, codeProp, dataset),
		);
	}

	calculateUnemploymentStats(
		geojson: BoundaryGeojson,
		dataset: UnemploymentDataset,
		location: string | null,
		datasetId: string | null,
	): AggregatedUnemploymentData | null {
		return this.byBoundary(
			"unemployment",
			"localAuthority",
			geojson,
			location,
			datasetId,
			(features, codeProp) =>
				aggregateUnemployment(features, codeProp, dataset),
		);
	}
}
