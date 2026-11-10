import {
	findMeasureObservations,
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type MeasureObservation,
	type MeasureSource,
} from "./dataCatalog.ts";
import { periodRecordLookup } from "./periodRecordLookup.ts";
import { measureSeriesKeySourceKey } from "./measureDimensions.ts";

export type ObservationArtifacts = {
	measureObservations?: AnyMeasureObservationArtifact[];
	seriesKey?: string;
};

const seriesObservations = new WeakMap<
	AnyMeasureObservationArtifact[],
	ReadonlyMap<string, AnyMeasureObservationArtifact>
>();

export const registerSeriesObservations = (
	artifacts: AnyMeasureObservationArtifact[],
	bySeriesSource: ReadonlyMap<string, AnyMeasureObservationArtifact>,
): void => {
	seriesObservations.set(artifacts, bySeriesSource);
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
	| ({ artifact: string; contentHash: string } & {
			readonly records: MeasureObservation[];
			recordFor(areaCode: string): MeasureObservation | undefined;
	  })
	| undefined => {
	const all = artifacts.measureObservations ?? [];
	const indexed = seriesObservations.get(all);
	const artifact =
		artifacts.seriesKey && indexed
			? indexed.get(
					measureSeriesKeySourceKey(artifacts.seriesKey, source),
				)
			: findMeasureObservations(all, measureId, source);
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
