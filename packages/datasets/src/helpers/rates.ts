/**
 * The size of the population a rate is taken over, recovered from a count and
 * the rate it gives: 250 claimants at 2.5% are 10,000 residents. Unknown where
 * the rate is zero, since any population gives none.
 */
export const denominator = (count: number, ratePer: number, rate: number) =>
	rate > 0 ? (count / rate) * ratePer : null;

/**
 * The mean of a value over records, each weighted by the size of the
 * population it describes, over the records that have both. A figure that is
 * a share or an average of something must be combined this way: a flat mean
 * of authorities' figures would weigh the Isles of Scilly as heavily as
 * Birmingham.
 */
export function weightedMean<T>(
	records: T[],
	value: (record: T) => number | null | undefined,
	weight: (record: T) => number | null | undefined,
): number | null {
	let weighted = 0,
		total = 0;
	for (const record of records) {
		const v = value(record);
		const w = weight(record);
		if (v == null || w == null || !(w > 0)) continue;
		weighted += v * w;
		total += w;
	}
	return total > 0 ? weighted / total : null;
}
