export interface SIMDDataZoneData {
	dzCode: string;
	dzName: string;
	councilAreaCode: string;
	councilAreaName: string;
	simdRank: number;
	simdQuintile: number;
	simdDecile: number;
}

export interface SIMDDataset {
	id: string;
	year: number;
	type: "simd";
	boundaryType: "dataZone";
	boundaryYear: number;
	data: Record<string, SIMDDataZoneData>;
	councilStats: Record<string, AggregatedSIMDData>;
	metadata: {
		source: string;
		notes: string[];
	};
}

export interface AggregatedSIMDData {
	averageSIMDRank: number;
	averageSIMDQuintile: number;
}
