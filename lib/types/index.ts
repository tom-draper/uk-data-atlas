
// lib/types/index.ts
// Main entry point - aggregates and re-exports all types

import { LocalElectionDataset, GeneralElectionDataset, AggregatedLocalElectionData, AggregatedGeneralElectionData } from "./elections";
import { PopulationDataset, AggregatedPopulationData } from "./population";
import { HousePriceDataset, AggregatedHousePriceData } from "./housePrice";
import { CrimeDataset } from "./crime";

export * from "./common";
export * from "./elections";
export * from "./population";
export * from "./housePrice";
export * from "./crime";
export * from "./geometry";
export * from "./mapOptions";

export type Dataset = GeneralElectionDataset | PopulationDataset | LocalElectionDataset | HousePriceDataset | CrimeDataset;

export type Datasets = {
    localElection: Record<string, LocalElectionDataset>;
    generalElection: Record<string, GeneralElectionDataset>;
    population: Record<string, PopulationDataset>;
    housePrice: Record<string, HousePriceDataset>;
    crime: Record<string, CrimeDataset>;
};

export type AggregatedData = {
    localElection: AggregatedLocalElectionData | null;
    generalElection: AggregatedGeneralElectionData | null;
    population: AggregatedPopulationData | null;
    housePrice: AggregatedHousePriceData | null;
    crime: null;
};

export type ActiveViz = {
    vizId: string;
    datasetType: keyof Datasets;
    datasetYear: number;
};