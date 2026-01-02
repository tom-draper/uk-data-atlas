// lib/types/index.ts
import {
	LocalElectionDataset,
	GeneralElectionDataset,
	AggregatedLocalElectionData,
	AggregatedGeneralElectionData,
	WardData,
	ConstituencyData,
	LocalAuthorityData,
} from "./elections";
import { PopulationDataset, AggregatedPopulationData } from "./population";
import { HousePriceDataset, AggregatedHousePriceData } from "./housePrice";
import { AggregatedCrimeData, CrimeDataset } from "./crime";
import { AggregatedIncomeData, IncomeDataset } from "./income";
import { AggregatedEthnicityData, EthnicityDataset } from "./ethnicity";

export * from "./common";
export * from "./boundaries";
export * from "./elections";
export * from "./population";
export * from "./housePrice";
export * from "./crime";
export * from "./geometry";
export * from "./mapOptions";
export * from "./income";
export * from "./ethnicity";

export type Dataset =
	| LocalElectionDataset
	| GeneralElectionDataset
	| PopulationDataset
	| EthnicityDataset
	| HousePriceDataset
	| CrimeDataset
	| IncomeDataset;

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
	localElection: AggregatedLocalElectionData | null;
	generalElection: AggregatedGeneralElectionData | null;
	population: AggregatedPopulationData | null;
	ethnicity: AggregatedEthnicityData | null;
	housePrice: AggregatedHousePriceData | null;
	crime: AggregatedCrimeData | null;
	income: AggregatedIncomeData | null;
};

export type ActiveViz = {
	vizId: string;
	datasetType: keyof Datasets | 'custom';
	datasetYear: number;
};

type AreaMap = {
	ward: WardData;
	constituency: ConstituencyData;
	localAuthority: LocalAuthorityData;
};

export type SelectedArea = {
	[K in keyof AreaMap]: {
		type: K;
		code: string;
		name: string;
		data: AreaMap[K];
	};
}[keyof AreaMap];
