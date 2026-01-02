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

export type Dataset =
    | LocalElectionDataset
    | GeneralElectionDataset
    | PopulationDataset
    | EthnicityDataset
    | HousePriceDataset
    | CrimeDataset
    | IncomeDataset
    | CustomDataset;

export type Datasets = {
    localElection: Record<string, LocalElectionDataset>;
    generalElection: Record<string, GeneralElectionDataset>;
    population: Record<string, PopulationDataset>;
    ethnicity: Record<string, EthnicityDataset>;
    housePrice: Record<string, HousePriceDataset>;
    crime: Record<string, CrimeDataset>;
    income: Record<string, IncomeDataset>;
};

export type AggregatedData = {
    localElection: Record<number, AggregatedLocalElectionData> | null;
    generalElection: Record<number, AggregatedGeneralElectionData> | null;
    population: Record<number, AggregatedPopulationData> | null;
    ethnicity: Record<number, AggregatedEthnicityData> | null;
    housePrice: Record<number, AggregatedHousePriceData> | null;
    crime: Record<number, AggregatedCrimeData> | null;
    income: Record<number, AggregatedIncomeData> | null;
    custom: Record<number, AggregatedCustomData> | null;
};

export type ActiveViz = {
    vizId: string;
    datasetType: keyof Datasets | 'custom';
    datasetYear: number;
};
