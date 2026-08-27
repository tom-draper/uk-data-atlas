export interface HousingAffordabilityLADData {
	ladCode: string;
	ladName: string;
	ratio: number;
}

export interface HousingAffordabilityDataset {
	id: string;
	type: "housingAffordability";
	year: 2025;
	boundaryType: "localAuthority";
	boundaryYear: 2025;
	data: Record<string, HousingAffordabilityLADData>;
}

export interface AggregatedHousingAffordabilityData {
	averageRatio: number;
}
