export interface NHSWaitingICBData {
	icbCode: string;
	icbName: string;
	total: number;
	over18Weeks: number;
	pctOver18Weeks: number;
}

export interface NHSWaitingDataset {
	id: string;
	type: "nhsWaiting";
	year: number;
	month: string;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, NHSWaitingICBData>;
	ladToIcb: Record<string, string>;
}

export interface AggregatedNHSWaitingData {
	total: number;
	over18Weeks: number;
	pctOver18Weeks: number;
}
