export interface BrexitAreaData {
	areaCode: string;
	areaName: string;
	region: string;
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

export interface BrexitDataset {
	id: string;
	year: number;
	type: "brexit";
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, BrexitAreaData>;
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
