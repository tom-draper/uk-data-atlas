export interface CarAvailabilityBreakdown {
	noCar: number;
	oneCar: number;
	twoCars: number;
	threeOrMoreCars: number;
	/** Households, which is the denominator for every share. */
	total: number;
}

export interface CarAvailabilityLAData {
	ladCode: string;
	breakdown: CarAvailabilityBreakdown;
}

export interface CarAvailabilityDataset {
	id: string;
	type: "car-availability";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, CarAvailabilityLAData>;
	metadata: { source: string; notes: string[] };
}

export interface AggregatedCarAvailabilityData {
	breakdown: CarAvailabilityBreakdown;
}
