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
	type: "claimant-count";
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

export interface ClaimantCountHistoryLADData {
	ladCode: string;
	ladName: string;
	totalCount: number;
	/** Missing where the publisher suppresses it, for a count of 1 or 2. */
	totalRate?: number;
}

/** One month of the claimant count on the authorities of April 2023. */
export interface ClaimantCountHistoryDataset {
	id: string;
	type: "claimant-count-history";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, ClaimantCountHistoryLADData>;
}
