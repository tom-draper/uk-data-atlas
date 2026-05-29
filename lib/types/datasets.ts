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
import {
	AggregatedBrexitData,
	BrexitConstituencyDataset,
	BrexitLADDataset,
} from "./referendum";
import { AggregatedIMDData, IMDDataset } from "./imd";
import { AggregatedSIMDData, SIMDDataset } from "./simd";
import { AggregatedWIMDData, WIMDDataset } from "./wimd";
import { AggregatedNIMDMData, NIMDMDataset } from "./nimdm";
import {
	AggregatedLifeExpectancyData,
	LifeExpectancyDataset,
} from "./lifeExpectancy";
import {
	AggregatedQualificationData,
	QualificationDataset,
} from "./qualification";
import { AggregatedBroadbandData, BroadbandDataset } from "./broadband";

export type Dataset =
	| LocalElectionDataset
	| GeneralElectionDataset
	| PopulationDataset
	| EthnicityDataset
	| HousePriceDataset
	| CrimeDataset
	| IncomeDataset
	| BrexitLADDataset
	| BrexitConstituencyDataset
	| CustomDataset
	| IMDDataset
	| SIMDDataset
	| WIMDDataset
	| NIMDMDataset
	| LifeExpectancyDataset
	| QualificationDataset
	| BroadbandDataset;

export type Datasets = {
	localElection: Record<string, LocalElectionDataset>;
	generalElection: Record<string, GeneralElectionDataset>;
	population: Record<string, PopulationDataset>;
	ethnicity: Record<string, EthnicityDataset>;
	housePrice: Record<string, HousePriceDataset>;
	crime: Record<string, CrimeDataset>;
	income: Record<string, IncomeDataset>;
	brexit: Record<string, BrexitLADDataset>;
	brexitConstituency: Record<string, BrexitConstituencyDataset>;
	imd: Record<string, IMDDataset>;
	simd: Record<string, SIMDDataset>;
	wimd: Record<string, WIMDDataset>;
	nimdm: Record<string, NIMDMDataset>;
	lifeExpectancy: Record<string, LifeExpectancyDataset>;
	qualification: Record<string, QualificationDataset>;
	broadband: Record<string, BroadbandDataset>;
};

export type AggregatedData = {
	localElection: Record<number, AggregatedLocalElectionData> | null;
	generalElection: Record<number, AggregatedGeneralElectionData> | null;
	population: Record<number, AggregatedPopulationData> | null;
	ethnicity: Record<number, AggregatedEthnicityData> | null;
	housePrice: Record<number, AggregatedHousePriceData> | null;
	crime: Record<number, AggregatedCrimeData> | null;
	income: Record<number, AggregatedIncomeData> | null;
	brexit: Record<number, AggregatedBrexitData> | null;
	brexitConstituency: Record<number, AggregatedBrexitData> | null;
	custom: Record<number, AggregatedCustomData> | null;
	imd: Record<number, AggregatedIMDData> | null;
	simd: Record<number, AggregatedSIMDData> | null;
	wimd: Record<number, AggregatedWIMDData> | null;
	nimdm: Record<number, AggregatedNIMDMData> | null;
	lifeExpectancy: Record<string, AggregatedLifeExpectancyData> | null;
	qualification: Record<number, AggregatedQualificationData> | null;
	broadband: Record<number, AggregatedBroadbandData> | null;
};

export type ActiveViz = {
	vizId: string;
	datasetType: keyof Datasets | "custom" | "brexitConstituency";
	datasetYear: number;
};
