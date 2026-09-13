import type { DeprivationSummary } from "./deprivation";

export interface NIMDMLSOAData {
	soaCode: string;
	soaName: string;
	lgdCode: string;
	lgdName: string;
	/** Published rank, where 1 is the most deprived of 890. */
	nimdmRank: number;
}

export interface NIMDMDataset {
	id: string;
	year: number;
	type: "nimdm";
	boundaryType: "superOutputArea";
	boundaryYear: number;
	data: Record<string, NIMDMLSOAData>;
	lgdStats: Record<string, AggregatedNIMDMData>;
	metadata: {
		source: string;
		notes: string[];
	};
}

/** A group of areas, summarised without averaging ranks or deciles. */
export type AggregatedNIMDMData = DeprivationSummary;
