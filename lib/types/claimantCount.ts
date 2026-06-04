export interface ClaimantCountLADData {
	ladCode: string;
	ladName: string;
	totalCount: number;
	totalRate: number;
	youthCount: number;
	youthRate: number;
}

export interface ClaimantCountDataset {
	id: string;
	type: "claimantCount";
	year: number;
	month: string;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, ClaimantCountLADData>;
}

export interface AggregatedClaimantCountData {
	totalCount: number;
	totalRate: number;
	youthCount: number;
	youthRate: number;
}
