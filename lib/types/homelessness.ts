export interface HomelessnessLADData {
	ladCode: string;
	ladName: string;
	householdsInTemporaryAccommodation: number;
	householdsPerThousand: number;
	householdsWithChildren: number;
	childrenInTemporaryAccommodation: number;
}

export interface HomelessnessDataset {
	id: string;
	type: "homelessness";
	year: 2026;
	quarter: "Jan-Mar 2026";
	boundaryType: "localAuthority";
	boundaryYear: 2025;
	data: Record<string, HomelessnessLADData>;
}

export interface AggregatedHomelessnessData {
	householdsInTemporaryAccommodation: number;
	householdsPerThousand: number;
	householdsWithChildren: number;
	childrenInTemporaryAccommodation: number;
}
