import {
	findMeasureObservations,
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type MeasureObservation,
	type MeasureSource,
} from "./dataCatalog";
import type { ObservationArtifactReference } from "./sourceExactProvenance";

export type ObservationArtifacts = {
	measureObservations?: AnyMeasureObservationArtifact[];
};

/** Resolve a source/period to its immutable observation artifact. */
export const observationsFor = (
	measureId: string,
	source: MeasureSource,
	period: string,
	artifacts: ObservationArtifacts,
):
	| (ObservationArtifactReference & { records: MeasureObservation[] })
	| undefined => {
	const artifact = findMeasureObservations(
		artifacts.measureObservations ?? [],
		measureId,
		source,
	);
	const records = artifact?.periods.find(
		(candidate) => candidate.period === period,
	)?.records;
	return artifact && records
		? {
				artifact: observationArtifactName(measureId, source),
				contentHash: artifact.contentHash,
				records,
			}
		: undefined;
};
