import type {
	AggregatedCrimeData,
	AggregatedCustomData,
	AggregatedHousePriceData,
	AggregatedIncomeData,
	CrimeDataset,
	Features,
	HousePriceWardData,
	PropertyKeys,
} from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type { IncomeDataset } from "@/lib/types/income";
import type { AggregatedUnemploymentData, UnemploymentDataset } from "@/lib/types/unemployment";

/** Averages each available annual unemployment rate across selected LADs. */
export function aggregateUnemployment(
	features: Features,
	codeProperty: PropertyKeys,
	dataset: UnemploymentDataset,
): AggregatedUnemploymentData | null {
	const sums: Record<number, number> = {};
	const counts: Record<number, number> = {};
	for (const year of dataset.years) {
		sums[year] = 0;
		counts[year] = 0;
	}

	for (const feature of features) {
		const record = dataset.data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!record) continue;
		for (const year of dataset.years) {
			const rate = record.rates[year];
			if (rate != null) {
				sums[year] += rate;
				counts[year]++;
			}
		}
	}

	const rates: Record<number, number> = {};
	let hasAny = false;
	for (const year of dataset.years) {
		if (counts[year] > 0) {
			rates[year] = sums[year] / counts[year];
			hasAny = true;
		}
	}

	return hasAny ? { years: dataset.years, latestYear: dataset.latestYear, rates } : null;
}

export function aggregateHousePrices(
	features: Features,
	codeProperty: PropertyKeys,
	data: Record<string, HousePriceWardData>,
): AggregatedHousePriceData {
	const yearlyTotals: Record<number, number> = {};
	const yearlyCounts: Record<number, number> = {};
	let totalPrice = 0, wardCount = 0;

	for (const feature of features) {
		const ward = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!ward) continue;
		const price2023 = ward.prices[2023];
		if (price2023 != null) {
			totalPrice += price2023;
			wardCount++;
		}
		for (const year of Object.keys(ward.prices)) {
			const numericYear = Number(year);
			const price = ward.prices[numericYear];
			if (price != null && numericYear <= 2023) {
				yearlyTotals[numericYear] = (yearlyTotals[numericYear] || 0) + price;
				yearlyCounts[numericYear] = (yearlyCounts[numericYear] || 0) + 1;
			}
		}
	}

	const averagePrices: Record<number, number> = {};
	for (const year of Object.keys(yearlyTotals)) {
		const numericYear = Number(year);
		averagePrices[numericYear] = yearlyTotals[numericYear] / yearlyCounts[numericYear];
	}
	return {
		averagePrice: wardCount > 0 ? totalPrice / wardCount : 0,
		wardCount,
		averagePrices,
	};
}

export function aggregateCrime(
	features: Features,
	codeProperty: PropertyKeys,
	data: CrimeDataset["data"],
): AggregatedCrimeData {
	let totalRecordedCrime = 0, count = 0;
	for (const feature of features) {
		const crime = data[getFeatureProp(feature.properties, codeProperty) ?? ""]?.totalRecordedCrime;
		if (crime != null) {
			totalRecordedCrime += crime;
			count++;
		}
	}
	return { averageRecordedCrime: count > 0 ? totalRecordedCrime / count : 0 };
}

export function aggregateIncome(
	features: Features,
	codeProperty: PropertyKeys,
	data: IncomeDataset["data"],
): AggregatedIncomeData {
	let totalMedianIncome = 0, count = 0;
	for (const feature of features) {
		const median = data[getFeatureProp(feature.properties, codeProperty) ?? ""]?.annual?.median;
		if (median != null) {
			totalMedianIncome += median;
			count++;
		}
	}
	return { averageIncome: count > 0 ? totalMedianIncome / count : 0 };
}

export function aggregateCustomDataset(
	features: Features,
	codeProperty: PropertyKeys,
	data: Record<string, number>,
): AggregatedCustomData {
	let sum = 0, count = 0;
	for (const feature of features) {
		const value = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (typeof value === "number") {
			sum += value;
			count++;
		}
	}
	return { count, average: count > 0 ? sum / count : 0 };
}
