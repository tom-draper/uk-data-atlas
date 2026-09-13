export interface LandAreaLADData {
	ladCode: string;
	ladName: string;
	/** Land only, excluding inland water. The denominator ONS uses for density. */
	landHectares: number;
	landSquareKm: number;
	/** Extent of the realm: land, inland water and the coastal strip. Larger. */
	extentHectares: number;
	inlandWaterHectares: number;
}

export interface LandAreaDataset {
	id: string;
	type: "landArea";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, LandAreaLADData>;
}
