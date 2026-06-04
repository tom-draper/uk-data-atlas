export interface SchoolPerformanceLADData {
	ladCode: string;
	ladName: string;
	ptL2basics94: number | null;
	ptL2basics95: number | null;
	avgAtt8: number | null;
	avgP8score: number | null;
	pupils: number | null;
}

export interface SchoolPerformanceDataset {
	id: string;
	type: "schoolPerformance";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, SchoolPerformanceLADData>;
}

export interface AggregatedSchoolPerformanceData {
	ptL2basics94: number | null;
	ptL2basics95: number | null;
	avgAtt8: number | null;
	avgP8score: number | null;
}
