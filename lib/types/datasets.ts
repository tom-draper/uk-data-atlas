// lib/types/datasets.ts
import {
	HousePriceDataset,
	AggregatedHousePriceData,
} from "@uk-data-atlas/datasets/types/housePrice";
import {
	AggregatedCrimeData,
	CrimeDataset,
} from "@uk-data-atlas/datasets/types/crime";
import {
	AggregatedIncomeData,
	IncomeDataset,
	WorkplaceIncomeDataset,
} from "@uk-data-atlas/datasets/types/income";
import { AggregatedCustomData, CustomDataset } from "./custom";
import { NetworkDataset } from "./network";
import {
	AggregatedBroadbandData,
	BroadbandDataset,
} from "@uk-data-atlas/datasets/types/broadband";
import {
	AggregatedAirQualityData,
	AirQualityDataset,
} from "@uk-data-atlas/datasets/types/airQuality";
import {
	AggregatedClaimantCountData,
	ClaimantCountDataset,
} from "@uk-data-atlas/datasets/types/claimantCount";
import {
	AggregatedSchoolPerformanceData,
	SchoolPerformanceDataset,
} from "@uk-data-atlas/datasets/types/schoolPerformance";
import {
	AggregatedNHSWaitingData,
	NHSWaitingDataset,
} from "@uk-data-atlas/datasets/types/nhsWaiting";
import {
	AggregatedUnemploymentData,
	UnemploymentDataset,
} from "@uk-data-atlas/datasets/types/unemployment";
import type {
	CatalogueDataset,
	CatalogueDatasetRecords,
} from "@/lib/data/catalog";
import type { DatasetCoverage } from "@uk-data-atlas/datasets/types/coverage";

type DatasetValue =
	| HousePriceDataset
	| CrimeDataset
	| IncomeDataset
	| WorkplaceIncomeDataset
	| CustomDataset
	| NetworkDataset
	| BroadbandDataset
	| AirQualityDataset
	| ClaimantCountDataset
	| SchoolPerformanceDataset
	| NHSWaitingDataset
	| UnemploymentDataset
	| CatalogueDataset;

/** Every map dataset may declare the countries its source can cover. */
export type Dataset = DatasetValue & DatasetCoverage;

export type Datasets = {
	housePrice: Record<string, HousePriceDataset>;
	crime: Record<string, CrimeDataset>;
	income: Record<string, IncomeDataset>;
	workplaceIncome: Record<string, WorkplaceIncomeDataset>;
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
export type VizView = "age" | "density" | "gender" | "healthy-life-expectancy";

/** Internal map selection, adapted from the public VisualizationRef at the URL boundary. */
export type ActiveViz = {
	datasetId: string;
	view?: VizView;
	datasetType: keyof Datasets | "custom" | "network";
	datasetYear: number;
};
