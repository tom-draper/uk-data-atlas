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

export interface AggregatedWIMDData {
	averageWIMDScore: number;
	averageWIMDRank: number;
	averageWIMDDecile: number;
}
