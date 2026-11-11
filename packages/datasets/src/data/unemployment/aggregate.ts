import type {
	AggregatedUnemploymentData,
	UnemploymentLADData,
} from "../../types/unemployment.ts";

/**
 * Each year's rate over the selected authorities, weighted by their
 * economically active residents: a rate is unemployed over economically
 * active, and that population is the level divided by the rate. A year no
 * authority has both for is left out.
 */
export function aggregateUnemployment(
	records: UnemploymentLADData[],
): AggregatedUnemploymentData | null {
	const years = [
		...new Set(
			records.flatMap((record) => Object.keys(record.rates).map(Number)),
		),
	].sort((a, b) => a - b);
	const unemployed: Record<number, number> = {};
	const active: Record<number, number> = {};
	for (const year of years) {
		unemployed[year] = 0;
		active[year] = 0;
	}

	for (const record of records) {
		for (const year of years) {
			const rate = record.rates[year];
			const level = record.levels?.[year];
			if (rate == null || level == null || !(rate > 0)) continue;
			unemployed[year] += level;
			active[year] += (level / rate) * 100;
		}
	}

	const rates: Record<number, number> = {};
	let hasAny = false;
	for (const year of years) {
		if (active[year] > 0) {
			rates[year] = (unemployed[year] / active[year]) * 100;
			hasAny = true;
		}
	}

	return hasAny
		? {
				years,
				latestYear: years[years.length - 1],
				rates,
				levels: unemployed,
			}
		: null;
}
