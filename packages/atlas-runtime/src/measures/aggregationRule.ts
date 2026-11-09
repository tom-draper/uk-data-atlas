import type { Measure, MeasureAggregation } from "@uk-data-atlas/measures";

/** How a non-aggregatable statistic reads in a sentence. */
export const statisticPhrase = (statistic: string) =>
	({
		median: "a median",
		rank: "a rank",
		decile: "a decile",
		"life-expectancy": "a life expectancy",
	})[statistic] ?? `a ${statistic}`;

/** A weighted mean the measure declares and the API offers. */
export type AvailableWeightedAggregation = Extract<
	MeasureAggregation,
	{ kind: "intensive" }
> & { available: true };

/**
 * How a measure's values combine over areas, as it declares. The one place
 * that reads `aggregation`, so the API's aggregate route and the shared
 * measure query refuse a median, a rank or an unavailable rate in the same
 * words.
 */
export type AggregationRule =
	| { kind: "sum" }
	| { kind: "weighted-mean"; weighted: AvailableWeightedAggregation }
	| { kind: "unsupported"; detail: string };

export const aggregationRule = (
	measure: Pick<Measure, "aggregation">,
): AggregationRule => {
	const { aggregation } = measure;
	if (aggregation.kind === "extensive" && aggregation.available)
		return { kind: "sum" };
	if (
		aggregation.kind === "intensive" &&
		aggregation.operation === "weighted-mean" &&
		aggregation.available === true
	)
		return {
			kind: "weighted-mean",
			weighted: { ...aggregation, available: true },
		};
	return {
		kind: "unsupported",
		detail:
			aggregation.kind === "non-aggregatable"
				? `This measure is ${statisticPhrase(aggregation.statistic)} and cannot be combined over areas. ${aggregation.note}`
				: "This measure is not available for aggregation.",
	};
};
