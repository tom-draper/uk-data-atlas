import type { ScoredDeprivationSummary } from "./deprivation";

export interface IMDLSOAData {
	lsoaCode: string;
	lsoaName: string;
	ladCode: string;
	ladName: string;
	imdScore: number;
	imdRank: number;
	imdDecile: number;
	/** Mid-2015 population excluding prisoners, the index's own denominator. */
	population: number;
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

/** A group of areas: its population-weighted average score, and its share in the most deprived tenth. */
export type AggregatedIMDData = ScoredDeprivationSummary;
