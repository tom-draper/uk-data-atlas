import { refused, resolveObservations } from "./resolve/observationPlan";
import type { AggregationTarget } from "./aggregationTarget";
import { resolveAggregationTarget } from "./aggregationTarget";
import type { CompatibilityCandidate } from "./measureCompatibility";
import { compatibleReleasesForAggregation } from "./aggregationCompatibility";
import type { MeasureSource } from "./dataCatalog";
import type { RouteContext } from "./routing";
import { type ApiResponse } from "./routeResponse";

export type AggregationPartition = {
	source: MeasureSource;
	compatibleReleases: CompatibilityCandidate[];
	regional?: AggregationTarget;
};

/** Resolve the source partition and any explicit membership target together. */
export const resolveAggregationPartition = ({
	context,
	measureId,
	period,
	geography,
	boundaryYear,
	targetCode,
	regionCode,
	crosswalkId,
	sourceRelease,
}: {
	context: RouteContext;
	measureId: string;
	period: string;
	geography: string;
	boundaryYear: string;
	targetCode: string | null;
	regionCode: string | null;
	crosswalkId: string | null;
	sourceRelease: string | null;
}): AggregationPartition | ApiResponse => {
	const resolved = resolveObservations(context, {
		measureId,
		periods: [period],
		geography,
		boundaryYear,
	});
	if (resolved.kind === "refusal") return refused(resolved.refusal);
	const { source } = resolved.plan;
	const compatibleReleases = compatibleReleasesForAggregation({
		measureCompatibilityInventory: context.measureCompatibilityInventory,
		measureId,
		source,
		period,
	});
	const regional = resolveAggregationTarget({
		targetCode,
		regionCode,
		crosswalkId,
		sourceRelease,
		source,
		compatibleReleases,
		crosswalkLookup: context.crosswalkLookup,
		measureCompatibilityInventory: context.measureCompatibilityInventory,
		areaLookup: context.areaLookup,
	});
	if (regional && "status" in regional) return regional;
	return { source, compatibleReleases, regional };
};
