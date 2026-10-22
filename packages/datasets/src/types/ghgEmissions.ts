export interface GhgEmissionsLADData {
	ladCode: string;
	ladName: string;
	/** Net territorial emissions across every sector and gas, in kt CO2e. */
	totalKtCO2e: number;
	/**
	 * The same without land use, land use change and forestry. LULUCF is a net
	 * sink in much of the country, so including it can turn a rural authority's
	 * total negative; the gross figure is what most comparisons want.
	 */
	excludingLandUseKtCO2e: number;
	/** Net emissions per resident, in tonnes CO2e. */
	perPersonTCO2e: number;
	populationThousands: number;
	transport: number;
	domestic: number;
	industry: number;
	commercial: number;
	publicSector: number;
	agriculture: number;
	waste: number;
	landUse: number;
}

export interface GhgEmissionsDataset {
	id: string;
	type: "ghgEmissions";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, GhgEmissionsLADData>;
}

export interface AggregatedGhgEmissionsData {
	totalKtCO2e: number;
	excludingLandUseKtCO2e: number;
	perPersonTCO2e: number;
	transport: number;
	domestic: number;
	industry: number;
}
