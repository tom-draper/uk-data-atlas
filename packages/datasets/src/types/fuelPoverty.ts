export interface FuelPovertyLSOAData {
	lsoaCode: string;
	lsoaName: string;
	householdCount: number;
	fuelPoorHouseholdCount: number;
	fuelPovertyRate: number;
}

export interface FuelPovertyDataset {
	id: string;
	type: "fuel-poverty";
	year: number;
	boundaryType: "lsoa";
	boundaryYear: number;
	data: Record<string, FuelPovertyLSOAData>;
}

export interface AggregatedFuelPovertyData {
	householdCount: number;
	fuelPoorHouseholdCount: number;
	fuelPovertyRate: number;
}
