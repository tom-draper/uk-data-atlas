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
import type {
	CatalogueDataset,
	CatalogueDatasetRecords,
} from "@/lib/data/catalog";

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
	| CatalogueDataset;

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
} & CatalogueDatasetRecords;


/**
 * Which visualisation of a dataset that backs several. Datasets with a single
 * visualisation leave it unset.
 */
export type VizView = "age" | "density" | "gender";

/** The visualisation on the map: a dataset instance, and which of its views. */
export type ActiveViz = {
	datasetId: string;
	view?: VizView;
	datasetType: keyof Datasets | "custom" | "network";
	datasetYear: number;
};
