export interface AirQualityLADData {
	ladCode: string;
	ladName: string;
	no2Mean: number;
	pm25Mean: number | null;
	pm10Mean: number | null;
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
