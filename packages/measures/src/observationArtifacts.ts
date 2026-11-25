import {
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
	indexed?: boolean;
};

const seriesObservations = new WeakMap<
	AnyMeasureObservationArtifact[],
	ReadonlyMap<string, AnyMeasureObservationArtifact>
>();

type IndexedObservationPeriod = {
	contentHash: string;
	numeric: true;
	recordFor(areaCode: string): MeasureObservation | undefined;
	pageFrom(
		areaCode: string | undefined,
		limit: number,
	): MeasureObservation[] | undefined;
};

const indexedPeriods = new WeakMap<
	object,
	(period: string) => IndexedObservationPeriod | undefined
>();

export const registerIndexedPeriods = (
	artifact: object,
	read: (period: string) => IndexedObservationPeriod | undefined,
) => indexedPeriods.set(artifact, read);

export const registerSeriesObservations = (
	artifacts: AnyMeasureObservationArtifact[],
	bySeriesSource: ReadonlyMap<string, AnyMeasureObservationArtifact>,
): void => {
	seriesObservations.set(artifacts, bySeriesSource);
};

export const seriesObservationFor = (
	artifacts: AnyMeasureObservationArtifact[],
	seriesKey: string,
	source: MeasureSource,
): AnyMeasureObservationArtifact | undefined =>
	seriesObservations
		.get(artifacts)
		?.get(measureSeriesKeySourceKey(seriesKey, source));

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
			pageFrom?: IndexedObservationPeriod["pageFrom"];
			numeric?: true;
	  })
	| undefined => {
	const all = artifacts.measureObservations ?? [];
	const artifact = artifacts.seriesKey
		? seriesObservationFor(all, artifacts.seriesKey, source)
		: undefined;
	if (!artifact) return undefined;
	const name = observationArtifactName(measureId, source);
	const indexed = artifacts.indexed
		? indexedPeriods.get(artifact)?.(period)
		: undefined;
	if (indexed)
		return {
			artifact: name,
			...indexed,
			get records() {
				return artifact.periods.find(
					(candidate) => candidate.period === period,
				)!.records;
			},
		};
	const held = artifact.periods.find(
		(candidate) => candidate.period === period,
	);
	if (!held) return undefined;
	const lookup = periodRecordLookup(held);
	return {
		artifact: name,
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
