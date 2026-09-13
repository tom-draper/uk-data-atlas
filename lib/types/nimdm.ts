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

/**
 * NISRA publishes ranks, not deciles, for super output areas, so nothing here
 * carries a decile.
 */
export interface AggregatedNIMDMData {
	averageNIMDMRank: number;
}
