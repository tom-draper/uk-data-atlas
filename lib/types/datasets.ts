// lib/types/datasets.ts
import {
	type HousePriceDataset,
	type AggregatedHousePriceData,
} from "@uk-data-atlas/datasets";
import {
	type AggregatedIncomeData,
	type IncomeDataset,
	type WorkplaceIncomeDataset,
} from "@uk-data-atlas/datasets";
import { type AggregatedCustomData, type CustomDataset } from "./custom.ts";
import { type NetworkDataset } from "./network.ts";
import {
	type AggregatedAirQualityData,
	type AirQualityDataset,
} from "@uk-data-atlas/datasets";
import {
	type AggregatedSchoolPerformanceData,
	type SchoolPerformanceDataset,
} from "@uk-data-atlas/datasets";
import {
	type AggregatedUnemploymentData,
	type UnemploymentDataset,
} from "@uk-data-atlas/datasets";
import type {
	CatalogueDataset,
	CatalogueDatasetRecords,
} from "../data/catalog/index.ts";
import type { DatasetCoverage } from "@uk-data-atlas/datasets";

type DatasetValue =
	| HousePriceDataset
	| IncomeDataset
	| WorkplaceIncomeDataset
	| CustomDataset
	| NetworkDataset
	| AirQualityDataset
	| SchoolPerformanceDataset
	| UnemploymentDataset
	| CatalogueDataset;

/** Every map dataset may declare the countries its source can cover. */
export type Dataset = DatasetValue & DatasetCoverage;

export type Datasets = {
	housePrice: Record<string, HousePriceDataset>;
	income: Record<string, IncomeDataset>;
	workplaceIncome: Record<string, WorkplaceIncomeDataset>;
	airQuality: Record<string, AirQualityDataset>;
	schoolPerformance: Record<string, SchoolPerformanceDataset>;
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
