export interface BroadbandLADData {
	ladCode: string;
	ladName: string;
	pctSuperfast: number | null;
	pctUltrafast: number | null;
	pctFullFibre: number | null;
	pctGigabit: number | null;
	/** All premises in the authority, which every percentage is a share of. */
	premisesCount: number | null;
}

export interface BroadbandDataset {
	id: string;
	type: "broadband";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, BroadbandLADData>;
}

export interface AggregatedBroadbandData {
	pctSuperfast: number;
	pctUltrafast: number;
	pctFullFibre: number;
	pctGigabit: number;
}
