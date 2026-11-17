import type {
	AggregatedHousePriceData,
	HousePriceWardData,
} from "../../../types/housePrice.ts";

const YEAR = 2023;

const mean = (values: number[]) =>
	values.length === 0
		? 0
		: values.reduce((total, value) => total + value, 0) / values.length;

/** The mean of the wards' prices, as a price cannot be added up. */
export function aggregateHousePrices(
	records: HousePriceWardData[],
): AggregatedHousePriceData {
	const median = records.flatMap((ward) => ward.prices[YEAR] ?? []);
	const average = records.flatMap((ward) => ward.meanPrices[YEAR] ?? []);
	return {
		averagePrice: mean(median),
		averageMeanPrice: mean(average),
		wardCount: median.length,
	};
}
