// lib/types/datasets.ts
import {
	type HousePriceDataset,
	type AggregatedHousePriceData,
} from "@uk-data-atlas/datasets/types/housePrice";
import {
	type AggregatedCrimeData,
	type CrimeDataset,
} from "@uk-data-atlas/datasets/types/crime";
import {
	type AggregatedIncomeData,
	type IncomeDataset,
	type WorkplaceIncomeDataset,
} from "@uk-data-atlas/datasets/types/income";
import { type AggregatedCustomData, type CustomDataset } from "./custom.ts";
import { type NetworkDataset } from "./network.ts";
import {
	type AggregatedAirQualityData,
	type AirQualityDataset,
} from "@uk-data-atlas/datasets/types/airQuality";
import {
	type AggregatedSchoolPerformanceData,
	type SchoolPerformanceDataset,
} from "@uk-data-atlas/datasets/types/schoolPerformance";
import {
	type AggregatedNHSWaitingData,
	type NHSWaitingDataset,
} from "@uk-data-atlas/datasets/types/nhsWaiting";
import {
	type AggregatedUnemploymentData,
	type UnemploymentDataset,
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
	| AirQualityDataset
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
	airQuality: Record<string, AirQualityDataset>;
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
