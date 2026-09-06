/** The headline KS4 measures for one local authority district in one year. */
export interface SchoolPerformanceMeasures {
	ptL2basics94: number | null;
	ptL2basics95: number | null;
	avgAtt8: number | null;
	avgP8score: number | null;
	pupils: number | null;
}

export interface SchoolPerformanceLADData extends SchoolPerformanceMeasures {
	ladCode: string;
	ladName: string;
	/**
	 * Every academic year the release covers, keyed by the year it ends in.
	 * The fields above repeat the most recent year so callers that only want
	 * the headline figure need not reach into the series.
	 */
	series: Record<number, SchoolPerformanceMeasures>;
}

export interface SchoolPerformanceDataset {
	id: string;
	type: "schoolPerformance";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, SchoolPerformanceLADData>;
}

export interface SchoolPerformanceConstituencyData extends SchoolPerformanceMeasures {
	pconCode: string;
	pconName: string;
	/** Keyed by the year the academic year ends in, as above. */
	series: Record<number, SchoolPerformanceMeasures>;
}

export interface SchoolPerformanceConstituencyDataset {
	id: string;
	type: "schoolPerformanceConstituency";
	year: number;
	boundaryType: "constituency";
	boundaryYear: number;
	data: Record<string, SchoolPerformanceConstituencyData>;
}

export interface AggregatedSchoolPerformanceData {
	ptL2basics94: number | null;
	ptL2basics95: number | null;
	avgAtt8: number | null;
	avgP8score: number | null;
}
