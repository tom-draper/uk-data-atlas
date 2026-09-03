// lib/types/datasets.ts
import { HousePriceDataset, AggregatedHousePriceData } from "./housePrice";
import { AggregatedCrimeData, CrimeDataset } from "./crime";
import { AggregatedIncomeData, IncomeDataset } from "./income";
import { AggregatedCustomData, CustomDataset } from "./custom";
import { NetworkDataset } from "./network";
import { AggregatedBroadbandData, BroadbandDataset } from "./broadband";
import { AggregatedAirQualityData, AirQualityDataset } from "./airQuality";
import { AggregatedClaimantCountData, ClaimantCountDataset } from "./claimantCount";
import { AggregatedSchoolPerformanceData, SchoolPerformanceDataset } from "./schoolPerformance";
import { AggregatedNHSWaitingData, NHSWaitingDataset } from "./nhsWaiting";
import { AggregatedUnemploymentData, UnemploymentDataset } from "./unemployment";
import type { ChartDataset, ChartDatasetRecords } from "@/lib/datasets/generated";

export type Dataset =
	| HousePriceDataset
	| CrimeDataset
	| IncomeDataset
	| CustomDataset
	| NetworkDataset
	| BroadbandDataset
	| AirQualityDataset
	| ClaimantCountDataset
	| SchoolPerformanceDataset
	| NHSWaitingDataset
	| UnemploymentDataset
	| ChartDataset;

export type Datasets = {
	housePrice: Record<string, HousePriceDataset>;
	crime: Record<string, CrimeDataset>;
	income: Record<string, IncomeDataset>;
	broadband: Record<string, BroadbandDataset>;
	airQuality: Record<string, AirQualityDataset>;
	claimantCount: Record<string, ClaimantCountDataset>;
	schoolPerformance: Record<string, SchoolPerformanceDataset>;
	nhsWaiting: Record<string, NHSWaitingDataset>;
	unemployment: Record<string, UnemploymentDataset>;
} & ChartDatasetRecords;


export type ActiveViz = {
	vizId: string;
	datasetType: keyof Datasets | "custom" | "network" | "brexitConstituency";
	datasetYear: number;
};
