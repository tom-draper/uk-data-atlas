export interface PopulationConstituencyData {
	constituencyCode: string;
	constituencyName: string;
	/** The published total, which is the sum of the single years of age. */
	allAges: number;
	/** Residents of each single year of age from 0 to 90 (90 is 90 and over). */
	total: number[];
	males: number[];
	females: number[];
}

/** One mid-year's usual resident population by 2024 Westminster constituency. */
export interface PopulationConstituencyDataset {
	id: string;
	type: "population-constituency";
	year: number;
	boundaryType: "constituency";
	boundaryYear: number;
	data: Record<string, PopulationConstituencyData>;
}
