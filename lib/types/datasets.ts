// lib/types/datasets.ts
import { type AggregatedCustomData, type CustomDataset } from "./custom.ts";
import { type NetworkDataset } from "./network.ts";
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
	CustomDataset | NetworkDataset | UnemploymentDataset | CatalogueDataset;

/** Every map dataset may declare the countries its source can cover. */
export type Dataset = DatasetValue & DatasetCoverage;

export type Datasets = {
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
