export interface PopulationConstituencyData {
	constituencyCode: string;
	constituencyName: string;
	total: number;
}

/** One mid-year's usual resident population by 2024 Westminster constituency. */
export interface PopulationConstituencyDataset {
	id: string;
	type: "populationConstituency";
	year: number;
	boundaryType: "constituency";
	boundaryYear: number;
	data: Record<string, PopulationConstituencyData>;
}
