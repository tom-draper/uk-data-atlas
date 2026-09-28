import type { NamedLocation } from "./namedLocations";
import type { AggregateMembers } from "./aggregation";
import type { AggregationTarget } from "./aggregationTarget";
import type { PopulationObservation } from "./dataCatalog";
import { aggregateRecordsForTarget } from "./aggregateTargetMembers";
import { problem, type ApiResponse } from "./routeResponse";
import { calculateWeightedMean } from "./weightedMean";

type WeightedAggregateResult =
	{ kind: "ok"; value: number; totalWeight: number } | ApiResponse;

/** Apply the published weights to the already-resolved aggregation target. */
export const calculateWeightedAggregate = ({
	aggregate,
	weightRecords,
	location,
	regional,
	areaCode,
}: {
	aggregate: AggregateMembers;
	weightRecords: PopulationObservation[];
	location?: NamedLocation;
	regional?: AggregationTarget;
	areaCode?: string;
}): WeightedAggregateResult => {
	const weightAggregate = aggregateRecordsForTarget({
		location,
		regional,
		areaCode,
		records: weightRecords,
	});
	if (!weightAggregate) {
		return problem(
			400,
			"Invalid Query",
			"Supply exactly one of locationId, areaCode or targetCode.",
		);
	}
	const weightedMean = calculateWeightedMean(
		aggregate.members,
		weightAggregate.members,
	);
	if (weightedMean.kind === "partial_coverage") {
		return problem(
			422,
			"Operation Not Supported",
			"The published value and weight partitions do not cover the same source areas, so no partial weighted mean was calculated.",
			{ code: "partial_coverage" },
		);
	}
	if (weightedMean.kind === "invalid_weights") {
		return problem(
			422,
			"Operation Not Supported",
			"The published weights must be finite, non-negative and sum to more than zero.",
			{ code: "aggregation_not_supported" },
		);
	}
	return {
		kind: "ok",
		value: weightedMean.value,
		totalWeight: weightedMean.totalWeight,
	};
};
