import type {
	AggregatedCarAvailabilityData,
	CarAvailabilityLAData,
} from "../../types/carAvailability.ts";

/** Sum of the households by cars or vans available over the authorities. */
export function aggregateCarAvailability(
	records: CarAvailabilityLAData[],
): AggregatedCarAvailabilityData {
	const total = {
		noCar: 0,
		oneCar: 0,
		twoCars: 0,
		threeOrMoreCars: 0,
		total: 0,
	};
	for (const { breakdown } of records)
		for (const key of Object.keys(total) as Array<keyof typeof total>)
			total[key] += breakdown[key];
	return { breakdown: total };
}
