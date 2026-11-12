import type {
	AggregatedTravelToWorkData,
	TravelToWorkLAData,
} from "../../types/travelToWork.ts";

/** Sum of the people in employment by method of travel over the authorities. */
export function aggregateTravelToWork(
	records: TravelToWorkLAData[],
): AggregatedTravelToWorkData {
	const total = {
		workFromHome: 0,
		publicTransport: 0,
		car: 0,
		taxi: 0,
		motorcycle: 0,
		bicycle: 0,
		onFoot: 0,
		other: 0,
		total: 0,
	};
	for (const { breakdown } of records)
		for (const key of Object.keys(total) as Array<keyof typeof total>)
			total[key] += breakdown[key];
	return { breakdown: total };
}
