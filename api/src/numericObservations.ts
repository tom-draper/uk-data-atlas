import {
	isNumericObservation,
	type MeasureSource,
	type PopulationObservation,
} from "./dataCatalog";
import {
	observationsFor,
	type ObservationArtifacts,
} from "./observationArtifacts";
import type { ObservationArtifactReference } from "./sourceExactProvenance";

export type NumericObservationResult =
	| {
			kind: "ok";
			observations: ObservationArtifactReference;
			records: PopulationObservation[];
	  }
	| { kind: "missing" }
	| { kind: "non_numeric" };

export type NumericObservationSuccess = Extract<
	NumericObservationResult,
	{ kind: "ok" }
>;

/** Resolve one source period and require the numeric records aggregation needs. */
export const numericObservationsFor = (
	measureId: string,
	source: MeasureSource,
	period: string,
	artifacts: ObservationArtifacts,
): NumericObservationResult => {
	const observations = observationsFor(measureId, source, period, artifacts);
	if (!observations) return { kind: "missing" };
	const records = observations.records.filter(isNumericObservation);
	return records.length === observations.records.length
		? { kind: "ok", observations, records }
		: { kind: "non_numeric" };
};
