export interface UnemploymentLADData {
	ladCode: string;
	ladName: string;
	rates: Record<number, number | null>; // year -> unemployment rate (%)
	/** Half-width of the published 95% confidence interval around each rate. */
	rateIntervals?: Record<number, number | null>;
	/** Modelled count of unemployed residents aged 16 and over. */
	levels?: Record<number, number | null>;
	/** Half-width of the published 95% confidence interval around each level. */
	levelIntervals?: Record<number, number | null>;
	/**
	 * Set on an authority the model does not estimate, whose values the loader
	 * built from these predecessors' estimates. Such a value is not a published
	 * estimate.
	 */
	derivedFromPredecessors?: string[];
}

export interface UnemploymentDataset {
	id: string;
	type: "unemployment";
	year: number; // Mirrors latestYear for the common dataset contract.
	boundaryType: "localAuthority";
	boundaryYear: number;
	years: number[]; // sorted, 1996..2021
	/**
	 * What each year key stands for. The model runs on financial years to
	 * 2003/04 and calendar years from 2004, so 1996 is April 1996 to March 1997.
	 */
	periodLabels?: Record<number, string>;
	latestYear: number;
	data: Record<string, UnemploymentLADData>; // keyed by LAD code
}

export interface AggregatedUnemploymentData {
	years: number[];
	latestYear: number;
	rates: Record<number, number>; // year -> avg rate across visible LADs
}
