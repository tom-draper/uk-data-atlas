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

export interface AggregatedIMDData {
	averageIMDScore: number;
	averageIMDDecile: number;
}
