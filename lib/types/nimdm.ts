export interface NIMDMLSOAData {
	soaCode: string;
	soaName: string;
	lgdCode: string;
	lgdName: string;
	nimdmRank: number;
	nimdmDecile: number;
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

export interface AggregatedNIMDMData {
	averageNIMDMDecile: number;
}
