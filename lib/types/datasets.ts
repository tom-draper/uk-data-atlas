// lib/types/datasets.ts
import {
	LocalElectionDataset,
	GeneralElectionDataset,
	AggregatedLocalElectionData,
	AggregatedGeneralElectionData,
} from "./elections";
import { PopulationDataset, AggregatedPopulationData } from "./population";
import { HousePriceDataset, AggregatedHousePriceData } from "./housePrice";
import { AggregatedCrimeData, CrimeDataset } from "./crime";
import { AggregatedIncomeData, IncomeDataset } from "./income";
import { AggregatedEthnicityData, EthnicityDataset } from "./ethnicity";
import { AggregatedCustomData, CustomDataset } from "./custom";
import {
	AggregatedBrexitData,
	BrexitConstituencyDataset,
	BrexitLADDataset,
} from "./referendum";
import { AggregatedIMDData, IMDDataset } from "./imd";
import { AggregatedSIMDData, SIMDDataset } from "./simd";
import { AggregatedWIMDData, WIMDDataset } from "./wimd";
import { AggregatedNIMDMData, NIMDMDataset } from "./nimdm";
import {
	AggregatedLifeExpectancyData,
	LifeExpectancyDataset,
} from "./lifeExpectancy";
import {
	AggregatedQualificationData,
	QualificationDataset,
} from "./qualification";
import { AggregatedBroadbandData, BroadbandDataset } from "./broadband";
import { AggregatedAirQualityData, AirQualityDataset } from "./airQuality";
import { AggregatedClaimantCountData, ClaimantCountDataset } from "./claimantCount";
import { AggregatedSchoolPerformanceData, SchoolPerformanceDataset } from "./schoolPerformance";
import { AggregatedNHSWaitingData, NHSWaitingDataset } from "./nhsWaiting";
import { AggregatedUnemploymentData, UnemploymentDataset } from "./unemployment";
import { AggregatedChildPovertyData, ChildPovertyDataset } from "./childPoverty";
import { AggregatedHomelessnessData, HomelessnessDataset } from "./homelessness";

export type Dataset =
	| LocalElectionDataset
	| GeneralElectionDataset
	| PopulationDataset
	| EthnicityDataset
	| HousePriceDataset
	| CrimeDataset
	| IncomeDataset
	| BrexitLADDataset
	| BrexitConstituencyDataset
	| CustomDataset
	| IMDDataset
	| SIMDDataset
	| WIMDDataset
	| NIMDMDataset
	| LifeExpectancyDataset
	| QualificationDataset
	| BroadbandDataset
	| AirQualityDataset
	| ClaimantCountDataset
	| SchoolPerformanceDataset
	| NHSWaitingDataset
	| UnemploymentDataset
	| ChildPovertyDataset
	| HomelessnessDataset;

export type Datasets = {
	localElection: Record<string, LocalElectionDataset>;
	generalElection: Record<string, GeneralElectionDataset>;
	population: Record<string, PopulationDataset>;
	ethnicity: Record<string, EthnicityDataset>;
	housePrice: Record<string, HousePriceDataset>;
	crime: Record<string, CrimeDataset>;
	income: Record<string, IncomeDataset>;
	brexit: Record<string, BrexitLADDataset>;
	brexitConstituency: Record<string, BrexitConstituencyDataset>;
	imd: Record<string, IMDDataset>;
	simd: Record<string, SIMDDataset>;
	wimd: Record<string, WIMDDataset>;
	nimdm: Record<string, NIMDMDataset>;
	lifeExpectancy: Record<string, LifeExpectancyDataset>;
	qualification: Record<string, QualificationDataset>;
	broadband: Record<string, BroadbandDataset>;
	airQuality: Record<string, AirQualityDataset>;
	claimantCount: Record<string, ClaimantCountDataset>;
	schoolPerformance: Record<string, SchoolPerformanceDataset>;
	nhsWaiting: Record<string, NHSWaitingDataset>;
	unemployment: Record<string, UnemploymentDataset>;
	childPoverty: Record<string, ChildPovertyDataset>;
	homelessness: Record<string, HomelessnessDataset>;
};


export type ActiveViz = {
	vizId: string;
	datasetType: keyof Datasets | "custom" | "brexitConstituency";
	datasetYear: number;
};
