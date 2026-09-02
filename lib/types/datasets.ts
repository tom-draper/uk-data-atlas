// lib/types/datasets.ts
import {
	LocalElectionDataset,
	GeneralElectionDataset,
	AggregatedLocalElectionData,
	AggregatedGeneralElectionData,
} from "./elections";
import { HousePriceDataset, AggregatedHousePriceData } from "./housePrice";
import { AggregatedCrimeData, CrimeDataset } from "./crime";
import { AggregatedIncomeData, IncomeDataset } from "./income";
import { AggregatedCustomData, CustomDataset } from "./custom";
import {
	AggregatedBrexitData,
	BrexitConstituencyDataset,
	BrexitLADDataset,
} from "./referendum";
import { AggregatedBroadbandData, BroadbandDataset } from "./broadband";
import { AggregatedAirQualityData, AirQualityDataset } from "./airQuality";
import { AggregatedClaimantCountData, ClaimantCountDataset } from "./claimantCount";
import { AggregatedSchoolPerformanceData, SchoolPerformanceDataset } from "./schoolPerformance";
import { AggregatedNHSWaitingData, NHSWaitingDataset } from "./nhsWaiting";
import { AggregatedUnemploymentData, UnemploymentDataset } from "./unemployment";
import type { ScalarDataset, ScalarDatasetRecords } from "@/lib/datasets/generated";

export type Dataset =
	| LocalElectionDataset
	| GeneralElectionDataset
	| HousePriceDataset
	| CrimeDataset
	| IncomeDataset
	| BrexitLADDataset
	| BrexitConstituencyDataset
	| CustomDataset
	| BroadbandDataset
	| AirQualityDataset
	| ClaimantCountDataset
	| SchoolPerformanceDataset
	| NHSWaitingDataset
	| UnemploymentDataset
	| ScalarDataset;

export type Datasets = {
	localElection: Record<string, LocalElectionDataset>;
	generalElection: Record<string, GeneralElectionDataset>;
	housePrice: Record<string, HousePriceDataset>;
	crime: Record<string, CrimeDataset>;
	income: Record<string, IncomeDataset>;
	brexit: Record<string, BrexitLADDataset>;
	brexitConstituency: Record<string, BrexitConstituencyDataset>;
	broadband: Record<string, BroadbandDataset>;
	airQuality: Record<string, AirQualityDataset>;
	claimantCount: Record<string, ClaimantCountDataset>;
	schoolPerformance: Record<string, SchoolPerformanceDataset>;
	nhsWaiting: Record<string, NHSWaitingDataset>;
	unemployment: Record<string, UnemploymentDataset>;
} & ScalarDatasetRecords;


export type ActiveViz = {
	vizId: string;
	datasetType: keyof Datasets | "custom" | "brexitConstituency";
	datasetYear: number;
};
