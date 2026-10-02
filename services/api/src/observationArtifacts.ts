import {
	findMeasureObservations,
	isLegacyPopulationSource,
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type MeasureObservation,
	type MeasureSource,
	type PopulationLocalAuthorityObservationArtifact,
	type PopulationObservationArtifact,
} from "./dataCatalog";
import type { ObservationArtifactReference } from "./sourceExactProvenance";

export type ObservationArtifacts = {
	populationObservations?: PopulationObservationArtifact;
	populationLocalAuthorityObservations?: PopulationLocalAuthorityObservationArtifact;
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
	if (isLegacyPopulationSource(measureId, source)) {
		if (source.sourceGeography.type === "ward") {
			const artifact = artifacts.populationObservations;
			return artifact && artifact.period === period
				? {
						artifact: "population-observations",
						contentHash: artifact.contentHash,
						records: artifact.records,
					}
				: undefined;
		}
		const artifact = artifacts.populationLocalAuthorityObservations;
		const records = artifact?.periods.find(
			(candidate) => candidate.period === period,
		)?.records;
		return artifact && records
			? {
					artifact: "population-local-authority-observations",
					contentHash: artifact.contentHash,
					records,
				}
			: undefined;
	}
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
