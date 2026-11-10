import {
	refused,
	resolveObservations,
} from "./observationResolution/observationPlan";
import type { AggregationTarget } from "./aggregationTarget";
import { resolveAggregationTarget } from "./aggregationTarget";
import type { CompatibilityCandidate } from "@uk-data-atlas/measures";
import { compatibleReleasesForAggregation } from "./aggregationCompatibility";
import type { Measure, MeasureSource } from "@uk-data-atlas/measures";
import type { RouteContextFor } from "./runtime/index.ts";
import { type ApiResponse } from "./runtime/index.ts";

export type AggregationPartition = {
	source: MeasureSource;
	compatibleReleases: CompatibilityCandidate[];
	regional?: AggregationTarget;
};

/** Resolve the source partition and any explicit membership target together. */
export const resolveAggregationPartition = ({
	context,
	measureId,
	measure,
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
	measure?: Measure;
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
		measure,
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
