export interface AirQualityLADData {
	ladCode: string;
	ladName: string;
	/**
	 * Mean of Defra's modelled 2024 background concentrations over the 1x1 km
	 * cells whose centres lie in the authority, µg m-3. An area mean, not a
	 * population-weighted one.
	 */
	no2Mean: number;
	pm25Mean: number | null;
	pm10Mean: number | null;
	/** How many grid cells the area means average over. */
	gridCells: number;
	/** Defra's published population-weighted annual mean PM2.5, µg m-3. */
	pm25PopulationWeighted: number | null;
	/** The anthropogenic part of that PM2.5, µg m-3. */
	pm25PopulationWeightedAnthropogenic: number | null;
}

export interface AirQualityDataset {
	id: string;
	type: "airQuality";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, AirQualityLADData>;
}

export interface AggregatedAirQualityData {
	no2Mean: number;
	pm25Mean: number | null;
	pm10Mean: number | null;
}
