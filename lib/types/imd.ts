import type { DeprivationSummary } from "./deprivation";

export interface IMDLSOAData {
	lsoaCode: string;
	lsoaName: string;
	ladCode: string;
	ladName: string;
	imdScore: number;
	imdRank: number;
	imdDecile: number;
	incomeScore: number;
	employmentScore: number;
	educationScore: number;
	healthScore: number;
	crimeScore: number;
	housingScore: number;
	livingEnvironmentScore: number;
}

export interface IMDDataset {
	id: string;
	year: number;
	type: "imd";
	boundaryType: "lsoa";
	boundaryYear: number;
	data: Record<string, IMDLSOAData>;
	ladStats: Record<string, AggregatedIMDData>;
	metadata: {
		source: string;
		notes: string[];
	};
}

/** A group of areas, summarised without averaging ranks or deciles. */
export type AggregatedIMDData = DeprivationSummary;
