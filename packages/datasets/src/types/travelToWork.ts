export interface TravelToWorkBreakdown {
	workFromHome: number;
	/** Underground, metro, light rail and tram, train, and bus. */
	publicTransport: number;
	/** Driving and being driven; the census counts the two separately. */
	car: number;
	taxi: number;
	motorcycle: number;
	bicycle: number;
	onFoot: number;
	other: number;
	/** People in employment, which is the denominator for every share. */
	total: number;
}

export interface TravelToWorkLAData {
	ladCode: string;
	breakdown: TravelToWorkBreakdown;
}

export interface TravelToWorkDataset {
	id: string;
	type: "travel-to-work";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, TravelToWorkLAData>;
	metadata: { source: string; notes: string[] };
}

export interface AggregatedTravelToWorkData {
	breakdown: TravelToWorkBreakdown;
}
