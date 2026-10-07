import type { Measure } from "./dataCatalog";
import { defaultSource, type DefaultedSource } from "./dataDefaults";
import {
	resolveObservations,
	type ObservationPlan,
	type Resolution,
} from "./observationResolution/observationPlan";
import type { RouteContext } from "./routing";

type SourceQuery = {
	period?: string | null;
	geography?: string | null;
	boundaryYear?: string | null;
	datasetId?: string | null;
};

export type SourcePartitionSelection =
	| {
			kind: "selected";
			defaults: DefaultedSource | undefined;
			period: string | null;
			geography: string;
			boundaryYear: string;
			plan: ObservationPlan;
	  }
	| {
			kind: "incomplete";
			defaults: DefaultedSource | undefined;
			period: string | null;
			geography: string | null;
			boundaryYear: string | null;
	  }
	| {
			kind: "refusal";
			defaults: DefaultedSource | undefined;
			resolution: Extract<Resolution, { kind: "refusal" }>;
	  };

/** Apply shared defaults, then resolve exactly the partition those defaults name. */
export const selectSourcePartition = ({
	context,
	measure,
	query,
	periods = query.period ? [query.period] : [],
	periodsForResolution,
	includePeriod = true,
}: {
	context: RouteContext;
	measure: Measure;
	query: SourceQuery;
	periods?: string[];
	/** Defaults may select a period that the resolver must then verify. */
	periodsForResolution?: (period: string | null) => string[];
	includePeriod?: boolean;
}): SourcePartitionSelection => {
	const defaults = defaultSource(measure, query, periods, includePeriod);
	const period = query.period ?? defaults?.period ?? null;
	const geography = query.geography ?? defaults?.geography ?? null;
	const boundaryYear = query.boundaryYear ?? defaults?.boundaryYear ?? null;
	if (!geography || !boundaryYear)
		return { kind: "incomplete", defaults, period, geography, boundaryYear };
	const resolution = resolveObservations(context, {
		measureId: measure.id,
		periods: periodsForResolution?.(period) ?? periods,
		geography,
		boundaryYear,
		datasetId: query.datasetId,
	});
	return resolution.kind === "refusal"
		? { kind: "refusal", defaults, resolution }
		: {
				kind: "selected",
				defaults,
				period,
				geography,
				boundaryYear,
				plan: resolution.plan,
			};
};
