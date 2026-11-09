import { type DataCatalog, type Measure } from "@uk-data-atlas/catalogue/node";
import {
	aggregationRule,
	type AvailableWeightedAggregation,
} from "@uk-data-atlas/measures";
import { problem, type ApiResponse } from "@uk-data-atlas/atlas-runtime/api";

export type { AvailableWeightedAggregation };

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
	const rule = aggregationRule(measure);
	if (rule.kind === "unsupported") {
		return problem(422, "Operation Not Supported", rule.detail, {
			code: "aggregation_not_supported",
		});
	}
	const weightedAggregation =
		rule.kind === "weighted-mean" ? rule.weighted : undefined;
	return { dataCatalog, measure, weightedAggregation };
};
