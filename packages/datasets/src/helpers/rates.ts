/**
 * The size of the population a rate is taken over, recovered from a count and
 * the rate it gives: 250 claimants at 2.5% are 10,000 residents. Unknown where
 * the rate is zero, since any population gives none.
 */
export const denominator = (count: number, ratePer: number, rate: number) =>
	rate > 0 ? (count / rate) * ratePer : null;
