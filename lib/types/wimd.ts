import type { ScoredDeprivationSummary } from "./deprivation";

export interface WIMDLSOAData {
	lsoaCode: string;
	lsoaName: string;
	ladCode: string;
	ladName: string;
	wimdScore: number;
	wimdRank: number;
	wimdDecile: number;
	/** ONS mid-2017 population estimate, the year WIMD 2019's denominators use. */
	population: number;
}

export interface WIMDDataset {
	id: string;
	year: number;
	type: "wimd";
	boundaryType: "lsoa";
	boundaryYear: number;
	data: Record<string, WIMDLSOAData>;
	ladStats: Record<string, AggregatedWIMDData>;
	metadata: {
		source: string;
		notes: string[];
	};
}

/** A group of areas: its population-weighted average score, and its share in the most deprived tenth. */
export type AggregatedWIMDData = ScoredDeprivationSummary;
