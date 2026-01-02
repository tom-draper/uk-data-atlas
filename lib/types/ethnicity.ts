import { BoundaryType } from "./boundaries";

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
	type: "ethnicity";
	year: number;
	boundaryType: BoundaryType;
	boundaryYear: number;
	data: Record<string, Record<string, EthnicityCategory>>;
	results: Record<string, string>;
}

export type AggregatedEthnicityData = Record<string, EthnicityCategory>;
