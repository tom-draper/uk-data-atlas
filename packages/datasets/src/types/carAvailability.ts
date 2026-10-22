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
	type: "carAvailability";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, CarAvailabilityLAData>;
	metadata: { source: string; notes: string[] };
}

export interface AggregatedCarAvailabilityData {
	breakdown: CarAvailabilityBreakdown;
}

export const CAR_AVAILABILITY_LEVELS = [
	{ key: "noCar", label: "No car or van" },
	{ key: "oneCar", label: "1 car or van" },
	{ key: "twoCars", label: "2 cars or vans" },
	{ key: "threeOrMoreCars", label: "3 or more" },
] as const;

export type CarAvailabilityKey =
	(typeof CAR_AVAILABILITY_LEVELS)[number]["key"];

export const CAR_AVAILABILITY_COLORS: Record<CarAvailabilityKey, string> = {
	noCar: "#3b82f6",
	oneCar: "#84cc16",
	twoCars: "#f97316",
	threeOrMoreCars: "#ef4444",
};
