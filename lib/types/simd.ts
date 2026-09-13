import type { DeprivationSummary } from "./deprivation";

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

/** A group of areas, summarised without averaging ranks or deciles. */
export type AggregatedSIMDData = DeprivationSummary;
