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

/**
 * How far ahead non-disadvantaged pupils are, in one area in one year. This is
 * a plain difference between the two groups' figures, not the Department for
 * Education's published "disadvantage gap index" — that is a national,
 * rank-based statistic on a different scale entirely.
 */
export interface SchoolPerformanceGapMeasures {
	att8Disadvantaged: number | null;
	att8NotDisadvantaged: number | null;
	/** Attainment 8 points, non-disadvantaged minus disadvantaged. */
	att8Gap: number | null;
	/** Percentage points at grade 4+ in English and maths, same direction. */
	engmath94Gap: number | null;
	disadvantagedPupils: number | null;
	notDisadvantagedPupils: number | null;
}

export interface SchoolPerformanceGapData extends SchoolPerformanceGapMeasures {
	ladCode: string;
	ladName: string;
	/** Keyed by the year the academic year ends in, as above. */
	series: Record<number, SchoolPerformanceGapMeasures>;
}

export interface SchoolPerformanceGapDataset {
	id: string;
	type: "schoolPerformanceGap";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, SchoolPerformanceGapData>;
}

export interface AggregatedSchoolPerformanceData {
	ptL2basics94: number | null;
	ptL2basics95: number | null;
	avgAtt8: number | null;
	avgP8score: number | null;
}

export interface AggregatedSchoolPerformanceGapData {
	att8Gap: number | null;
	att8Disadvantaged: number | null;
	att8NotDisadvantaged: number | null;
}
