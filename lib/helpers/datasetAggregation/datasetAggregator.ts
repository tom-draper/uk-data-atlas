// Boundary and cache adapter for dataset aggregation.
import {
	BoundaryGeojson,
	LocalElectionDataset,
	GeneralElectionDataset,
	PopulationDataset,
	HousePriceWardData,
	CrimeDataset,
	EthnicityDataset,
	BrexitLADDataset,
	BrexitConstituencyDataset,
} from "@lib/types";
import type { AggregationCache, BoundaryCodeDetector } from "./ports";
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
import { aggregateIMD, aggregateNIMDM, aggregateSIMD, aggregateWIMD } from "./deprivation";
import { aggregateEthnicity, aggregateLifeExpectancy, aggregateQualifications } from "./demographics";
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
import { BroadbandDataset, AggregatedBroadbandData } from "@/lib/types/broadband";
import { AirQualityDataset, AggregatedAirQualityData } from "@/lib/types/airQuality";
import { ClaimantCountDataset, AggregatedClaimantCountData } from "@/lib/types/claimantCount";
import { SchoolPerformanceDataset, AggregatedSchoolPerformanceData } from "@/lib/types/schoolPerformance";
import { NHSWaitingDataset, AggregatedNHSWaitingData } from "@/lib/types/nhsWaiting";
import { UnemploymentDataset, AggregatedUnemploymentData } from "@/lib/types/unemployment";
import { ChildPovertyDataset, AggregatedChildPovertyData } from "@/lib/types/childPoverty";
import { HomelessnessDataset, AggregatedHomelessnessData } from "@/lib/types/homelessness";
import { FuelPovertyDataset, AggregatedFuelPovertyData } from "@/lib/types/fuelPoverty";

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

	private calculateNumericStats<T, R>(
		cachePrefix: string,
		geojson: BoundaryGeojson,
		data: Record<string, T>,
		location: string | null,
		datasetId: string | null,
		codeLevel: "localAuthority" | "lsoa",
		aggregate: (records: T[]) => R | null,
	): R | null {
		return this.cached(`${cachePrefix}-${location}-${datasetId}`, () => {
			const codeProp = codeLevel === "lsoa"
				? this.propertyDetector.detectLSOACode(geojson.features)
				: this.propertyDetector.detectLocalAuthorityCode(geojson.features);
			return aggregate(collectBoundaryRecords(geojson.features, data, codeProp));
		});
	}

	calculateLocalElectionStats(
		geojson: BoundaryGeojson,
		wardData: LocalElectionDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`local-election-${location}-${datasetId}`, () => {
			const wardCodeProp = this.propertyDetector.detectWardCode(
				geojson.features,
			);
			return aggregateLocalElection(geojson.features, wardCodeProp, wardData);
		});
	}

	calculateGeneralElectionStats(
		geojson: BoundaryGeojson,
		constituencyData: GeneralElectionDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`general-election-${location}-${datasetId}`, () => {
			const constituencyCodeProp =
				this.propertyDetector.detectConstituencyCode(geojson.features);
			return aggregateGeneralElection(geojson.features, constituencyCodeProp, constituencyData);
		});
	}

	calculatePopulationStats(
		geojson: BoundaryGeojson,
		populationData: PopulationDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`population-${location}-${datasetId}`, () => {
			const wardCodeProp = this.propertyDetector.detectWardCode(
				geojson.features,
			);
			return aggregatePopulation(
				geojson.features,
				wardCodeProp,
				populationData,
			);
		});
	}

	calculateEthnicityStats(
		geojson: BoundaryGeojson,
		localAuthorityData: EthnicityDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`ethnicity-${location}-${datasetId}`, () => {
			const ladProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			return aggregateEthnicity(geojson.features, ladProp, localAuthorityData);
		});
	}

	calculateHousePriceStats(
		geojson: BoundaryGeojson,
		wardData: Record<string, HousePriceWardData>,
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`house-price-${location}-${datasetId}`, () => {
			const wardCodeProp = this.propertyDetector.detectWardCode(
				geojson.features,
			);
			return aggregateHousePrices(geojson.features, wardCodeProp, wardData);
		});
	}

	calculateCrimeStats(
		geojson: BoundaryGeojson,
		crimeData: CrimeDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`crime-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			return aggregateCrime(geojson.features, ladCodeProp, crimeData);
		});
	}

	calculateIncomeStats(
		geojson: BoundaryGeojson,
		incomeData: IncomeDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`income-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			return aggregateIncome(geojson.features, ladCodeProp, incomeData);
		});
	}

	calculateBrexitStats(
		geojson: BoundaryGeojson,
		brexitData: BrexitLADDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`brexit-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			return aggregateBrexit(geojson.features, ladCodeProp, brexitData);
		});
	}

	calculateBrexitConstituencyStats(
		geojson: BoundaryGeojson,
		constituencyData: BrexitConstituencyDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`brexitConstituency-${location}-${datasetId}`, () => {
			const codeProp = this.propertyDetector.detectConstituencyCode(
				geojson.features,
			);
			return aggregateBrexitConstituencies(geojson.features, codeProp, constituencyData);
		});
	}

	calculateCustomDatasetStats(
		geojson: BoundaryGeojson,
		data: Record<string, number>,
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`custom-dataset-${location}-${datasetId}`, () => {
			const codeProp = this.propertyDetector.detectCode(geojson.features);

			return aggregateCustomDataset(geojson.features, codeProp, data);
		});
	}

	calculateLifeExpectancyStats(
		geojson: BoundaryGeojson,
		leData: LifeExpectancyDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedLifeExpectancyData {
		return this.cached(`lifeExpectancy-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			return aggregateLifeExpectancy(geojson.features, ladCodeProp, leData);
		});
	}

	calculateSIMDStats(
		geojson: BoundaryGeojson,
		simdData: SIMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedSIMDData | null {
		return this.cached(`simd-${location}-${datasetId}`, () => {
			const dzCodeProp = this.propertyDetector.detectDataZoneCode(
				geojson.features,
			);
			return aggregateSIMD(geojson.features, dzCodeProp, simdData);
		});
	}

	calculateWIMDStats(
		geojson: BoundaryGeojson,
		wimdData: WIMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedWIMDData | null {
		return this.cached(`wimd-${location}-${datasetId}`, () => {
			const lsoaCodeProp = this.propertyDetector.detectLSOACode(
				geojson.features,
			);
			return aggregateWIMD(geojson.features, lsoaCodeProp, wimdData);
		});
	}

	calculateNIMDMStats(
		geojson: BoundaryGeojson,
		nimdmData: NIMDMDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedNIMDMData | null {
		return this.cached(`nimdm-${location}-${datasetId}`, () => {
			const soaCodeProp = this.propertyDetector.detectSOACode(
				geojson.features,
			);
			return aggregateNIMDM(geojson.features, soaCodeProp, nimdmData);
		});
	}

	calculateIMDStats(
		geojson: BoundaryGeojson,
		imdData: IMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedIMDData {
		return this.cached(`imd-${location}-${datasetId}`, () => {
			const lsoaCodeProp = this.propertyDetector.detectLSOACode(
				geojson.features,
			);
			return aggregateIMD(geojson.features, lsoaCodeProp, imdData);
		});
	}

	calculateQualificationStats(
		geojson: BoundaryGeojson,
		qualData: QualificationDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedQualificationData {
		return this.cached(`qualification-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			return aggregateQualifications(geojson.features, ladCodeProp, qualData);
		});
	}

	calculateBroadbandStats(
		geojson: BoundaryGeojson,
		broadbandData: BroadbandDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedBroadbandData | null {
		return this.calculateNumericStats(
			"broadband", geojson, broadbandData, location, datasetId, "localAuthority", aggregateBroadband,
		);
	}

	calculateAirQualityStats(
		geojson: BoundaryGeojson,
		airQualityData: AirQualityDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedAirQualityData | null {
		return this.calculateNumericStats(
			"airQuality", geojson, airQualityData, location, datasetId, "localAuthority", aggregateAirQuality,
		);
	}

	calculateClaimantCountStats(
		geojson: BoundaryGeojson,
		data: ClaimantCountDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedClaimantCountData | null {
		return this.calculateNumericStats(
			"claimantCount", geojson, data, location, datasetId, "localAuthority", aggregateClaimantCount,
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
			"schoolPerformance", geojson, data, location, datasetId, "localAuthority", aggregateSchoolPerformance,
		);
	}

	calculateNHSWaitingStats(
		geojson: BoundaryGeojson,
		dataset: NHSWaitingDataset,
		location: string | null,
		datasetId: string | null,
	): AggregatedNHSWaitingData | null {
		return this.cached(`nhsWaiting-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(geojson.features);
			return aggregateNHSWaiting(geojson.features, ladCodeProp, dataset);
		});
	}

	calculateUnemploymentStats(
		geojson: BoundaryGeojson,
		dataset: UnemploymentDataset,
		location: string | null,
		datasetId: string | null,
	): AggregatedUnemploymentData | null {
		return this.cached(`unemployment-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(geojson.features);
			return aggregateUnemployment(geojson.features, ladCodeProp, dataset);
		});
	}
}
