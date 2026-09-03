import type { Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
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
