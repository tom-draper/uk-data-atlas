export interface UnemploymentLADData {
	ladCode: string;
	ladName: string;
	rates: Record<number, number | null>; // year -> unemployment rate (%)
}

export interface UnemploymentDataset {
	id: string;
	type: "unemployment";
	year: number; // Mirrors latestYear for the common dataset contract.
	boundaryType: "localAuthority";
	boundaryYear: number;
	years: number[]; // sorted, 1996..2021
	latestYear: number;
	data: Record<string, UnemploymentLADData>; // keyed by LAD code
}

export interface AggregatedUnemploymentData {
	years: number[];
	latestYear: number;
	rates: Record<number, number>; // year -> avg rate across visible LADs
}
