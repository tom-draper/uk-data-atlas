import { BoundaryType } from "./common";

export interface Ethnicity {
    ethnicity: string;
    population: number;
    code: string;
}

export interface EthnicityCategory {
    [subcategory: string]: Ethnicity;
}

export interface EthnicityDataset {
    id: string;
    type: 'ethnicity';
    year: number;
    boundaryType: BoundaryType;
    boundaryYear: number;
    localAuthorityData: Record<string, Record<string, EthnicityCategory>>;
}

export interface AggregatedEthnicityData {
    2021: Record<string, EthnicityCategory>;
}