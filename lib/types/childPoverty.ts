export interface ChildPovertyLADData {
	ladCode: string;
	ladName: string;
	childCount: number;
	childrenPopulation: number;
	childPovertyRate: number;
}

export interface ChildPovertyDataset {
	id: string;
	type: "childPoverty";
	year: number;
	measure: "relativeLowIncomeBeforeHousingCosts";
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, ChildPovertyLADData>;
}

export interface AggregatedChildPovertyData {
	childCount: number;
	childPovertyRate: number;
}
