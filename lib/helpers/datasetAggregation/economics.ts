import type {
	AggregatedCrimeData,
	AggregatedCustomData,
	AggregatedHousePriceData,
	CrimeDataset,
	Features,
	HousePriceWardData,
	PropertyKeys,
} from "@/lib/types";
import { getFeatureProp } from "@/lib/types";

export function aggregateHousePrices(
	features: Features,
	codeProperty: PropertyKeys,
	data: Record<string, HousePriceWardData>,
): AggregatedHousePriceData {
	const yearlyTotals: Record<number, number> = {};
	const yearlyCounts: Record<number, number> = {};
	const yearlyMeanTotals: Record<number, number> = {};
	const yearlyMeanCounts: Record<number, number> = {};
	let totalPrice = 0,
		wardCount = 0,
		totalMeanPrice = 0,
		meanWardCount = 0;

	for (const feature of features) {
		const ward =
			data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!ward) continue;
		const price2023 = ward.prices[2023];
		if (price2023 != null) {
			totalPrice += price2023;
			wardCount++;
		}
		const meanPrice2023 = ward.meanPrices[2023];
		if (meanPrice2023 != null) {
			totalMeanPrice += meanPrice2023;
			meanWardCount++;
		}
		for (const year of Object.keys(ward.prices)) {
			const numericYear = Number(year);
			const price = ward.prices[numericYear];
			if (price != null && numericYear <= 2023) {
				yearlyTotals[numericYear] =
					(yearlyTotals[numericYear] || 0) + price;
				yearlyCounts[numericYear] =
					(yearlyCounts[numericYear] || 0) + 1;
			}
		}
		for (const year of Object.keys(ward.meanPrices)) {
			const numericYear = Number(year);
			const price = ward.meanPrices[numericYear];
			if (price != null && numericYear <= 2023) {
				yearlyMeanTotals[numericYear] =
					(yearlyMeanTotals[numericYear] || 0) + price;
				yearlyMeanCounts[numericYear] =
					(yearlyMeanCounts[numericYear] || 0) + 1;
			}
		}
	}

	const averagePrices: Record<number, number> = {};
	for (const year of Object.keys(yearlyTotals)) {
		const numericYear = Number(year);
		averagePrices[numericYear] =
			yearlyTotals[numericYear] / yearlyCounts[numericYear];
	}
	const averageMeanPrices: Record<number, number> = {};
	for (const year of Object.keys(yearlyMeanTotals)) {
		const numericYear = Number(year);
		averageMeanPrices[numericYear] =
			yearlyMeanTotals[numericYear] / yearlyMeanCounts[numericYear];
	}
	return {
		averagePrice: wardCount > 0 ? totalPrice / wardCount : 0,
		wardCount,
		averagePrices,
		averageMeanPrice:
			meanWardCount > 0 ? totalMeanPrice / meanWardCount : 0,
		averageMeanPrices,
	};
}

export function aggregateCustomDataset(
	features: Features,
	codeProperty: PropertyKeys,
	data: Record<string, number>,
): AggregatedCustomData {
	let sum = 0,
		count = 0;
	for (const feature of features) {
		const value =
			data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (typeof value === "number") {
			sum += value;
			count++;
		}
	}
	return { count, average: count > 0 ? sum / count : 0 };
}
