export interface BrexitLADData {
	ladCode: string;
	ladName: string;
	regionName: string;
	regionCode: string;
	electorate: number;
	validVotes: number;
	remain: number;
	leave: number;
	rejectedBallots: number;
	pctRemain: number;
	pctLeave: number;
	pctTurnout: number;
}

export interface BrexitLADDataset {
	id: string;
	year: number;
	type: "brexit";
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, BrexitLADData>;
	results: Record<string, "remain" | "leave">;
}

export interface AggregatedBrexitData {
	totalLeave: number;
	totalRemain: number;
	totalVotes: number;
	pctLeave: number;
	pctRemain: number;
	electorate: number;
}

export interface BrexitConstituencyData {
	constituencyCode: string;
	constituencyName: string;
	pctLeave: number;
	isKnownResult: boolean;
}

export interface BrexitConstituencyDataset {
	id: string;
	year: number;
	type: "brexitConstituency";
	boundaryType: "constituency";
	boundaryYear: number;
	data: Record<string, BrexitConstituencyData>;
	results: Record<string, "remain" | "leave">;
}
