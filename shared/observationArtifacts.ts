import {
	findMeasureObservations,
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type MeasureObservation,
	type MeasureSource,
} from "./dataCatalog";
import { periodRecordLookup } from "./observationTables";
import type { ObservationArtifactReference } from "./sourceExactProvenance";

export type ObservationArtifacts = {
	measureObservations?: AnyMeasureObservationArtifact[];
};

/**
 * Resolve a source/period to its immutable observation artifact. `records` is
 * read when first used, since a table's records are built on demand; a caller
 * asking about one area uses `recordFor`, which does not build them.
 */
export const observationsFor = (
	measureId: string,
	source: MeasureSource,
	period: string,
	artifacts: ObservationArtifacts,
):
	| (ObservationArtifactReference & {
			readonly records: MeasureObservation[];
			recordFor(areaCode: string): MeasureObservation | undefined;
	  })
	| undefined => {
	const artifact = findMeasureObservations(
		artifacts.measureObservations ?? [],
		measureId,
		source,
	);
	const held = artifact?.periods.find(
		(candidate) => candidate.period === period,
	);
	if (!artifact || !held) return undefined;
	const lookup = periodRecordLookup(held);
	return {
		artifact: observationArtifactName(measureId, source),
		contentHash: artifact.contentHash,
		get records() {
			return held.records;
		},
		recordFor: (areaCode) =>
			lookup
				? lookup(areaCode)
				: held.records.find((record) => record.areaCode === areaCode),
	};
};
