
// lib/types/index.ts
// Main entry point - aggregates and re-exports all types

import { LocalElectionDataset, GeneralElectionDataset, AggregatedLocalElectionData, AggregatedGeneralElectionData } from "./elections";
import { PopulationDataset, AggregatedPopulationData } from "./population";
import { HousePriceDataset, AggregatedHousePriceData } from "./housePrice";
import { CrimeDataset } from "./crime";
import { IncomeDataset } from "./income";

export * from "./common";
export * from "./elections";
export * from "./population";
export * from "./housePrice";
export * from "./crime";
export * from "./geometry";
export * from "./mapOptions";
export * from "./income";

export type Dataset = GeneralElectionDataset | PopulationDataset | LocalElectionDataset | HousePriceDataset | CrimeDataset | IncomeDataset;

export type Datasets = {
    localElection: Record<string, LocalElectionDataset>;
    generalElection: Record<string, GeneralElectionDataset>;
    population: Record<string, PopulationDataset>;
    housePrice: Record<string, HousePriceDataset>;
    crime: Record<string, CrimeDataset>;
    income: Record<string, IncomeDataset>;
};

export type AggregatedData = {
    localElection: AggregatedLocalElectionData | null;
    generalElection: AggregatedGeneralElectionData | null;
    population: AggregatedPopulationData | null;
    housePrice: AggregatedHousePriceData | null;
    crime: null;
    income: null;
};

export type ActiveViz = {
    vizId: string;
    datasetType: keyof Datasets;
    datasetYear: number;
};