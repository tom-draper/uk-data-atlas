/** A published estimate with its 95% confidence interval, in years. */
export interface LifeExpectancyEstimate {
	value: number;
	lower: number;
	upper: number;
}

export interface LifeExpectancySeriesLADData {
	ladCode: string;
	ladName: string;
	male: LifeExpectancyEstimate;
	female: LifeExpectancyEstimate;
}

/**
 * One three-year period of life expectancy at birth, keyed by its final year.
 * ONS restates every period on the same local-authority codes, so the whole
 * series shares one boundary vintage.
 */
export interface LifeExpectancySeriesDataset {
	id: string;
	type: "lifeExpectancySeries";
	year: number;
	/** The span the estimate covers, e.g. "2020-2022". */
	period: string;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, LifeExpectancySeriesLADData>;
}
