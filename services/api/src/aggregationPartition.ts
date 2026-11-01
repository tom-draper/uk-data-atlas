import {
	refused,
	resolveObservations,
} from "./observationResolution/observationPlan";
import type { AggregationTarget } from "./aggregationTarget";
import { resolveAggregationTarget } from "./aggregationTarget";
import type { CompatibilityCandidate } from "@uk-data-atlas/measures";
import { compatibleReleasesForAggregation } from "./aggregationCompatibility";
import type { MeasureSource } from "@uk-data-atlas/measures";
import type { RouteContextFor } from "@uk-data-atlas/atlas-runtime/api";
import { type ApiResponse } from "@uk-data-atlas/atlas-runtime/api";

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
	targetGeography,
	crosswalkId,
	pathId,
	sourceRelease,
}: {
	context: RouteContextFor<
		"area" | "crosswalk" | "indexedPathSteps" | "relationshipPath"
	>;
	measureId: string;
	period: string;
	geography: string;
	boundaryYear: string;
	targetCode: string | null;
	targetGeography: string | null;
	crosswalkId: string | null;
	pathId: string | null;
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
		targetGeography,
		crosswalkId,
		pathId,
		sourceRelease,
		source,
		compatibleReleases,
		geographyResolver: context.geographyResolver,
		measureCompatibilityInventory: context.measureCompatibilityInventory,
	});
	if (regional && "status" in regional) return regional;
	return { source, compatibleReleases, regional };
};
