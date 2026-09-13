import type { DeprivationSummary } from "./deprivation";

export interface WIMDLSOAData {
	lsoaCode: string;
	lsoaName: string;
	ladCode: string;
	ladName: string;
	wimdScore: number;
	wimdRank: number;
	wimdDecile: number;
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

/** A group of areas, summarised without averaging ranks or deciles. */
export type AggregatedWIMDData = DeprivationSummary;
