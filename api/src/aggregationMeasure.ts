import type { DataCatalog, Measure, MeasureAggregation } from "./dataCatalog";
import { statisticPhrase } from "./aggregation";
import { problem, type ApiResponse } from "./routeResponse";

export type AvailableWeightedAggregation = Extract<
	MeasureAggregation,
	{ kind: "intensive" }
> & { available: true };

export type AggregationMeasure = {
	dataCatalog: DataCatalog;
	measure: Measure;
	weightedAggregation?: AvailableWeightedAggregation;
};

/** Resolve a measure and establish the aggregation operation it supports. */
export const resolveAggregationMeasure = ({
	dataCatalog,
	measureId,
}: {
	dataCatalog?: DataCatalog;
	measureId: string;
}): AggregationMeasure | ApiResponse => {
	if (!dataCatalog) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before aggregating observations.",
		);
	}
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure) {
		return problem(
			404,
			"Not Found",
			"No published measure serves aggregation at that path.",
		);
	}
	const weightedAggregation =
		measure.aggregation.kind === "intensive" &&
		measure.aggregation.operation === "weighted-mean" &&
		measure.aggregation.available
			? measure.aggregation
			: undefined;
	const usesSum =
		measure.aggregation.kind === "extensive" &&
		measure.aggregation.available;
	if (!usesSum && !weightedAggregation) {
		return problem(
			422,
			"Operation Not Supported",
			measure.aggregation.kind === "non-aggregatable"
				? `This measure is ${statisticPhrase(measure.aggregation.statistic)} and cannot be combined over areas. ${measure.aggregation.note}`
				: "This measure is not available for aggregation.",
			{ code: "aggregation_not_supported" },
		);
	}
	return { dataCatalog, measure, weightedAggregation };
};
