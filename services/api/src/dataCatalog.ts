import type {
	SourceGeography,
	MeasureSource,
} from "../../../shared/dataCatalog";
export type * from "../../../shared/dataCatalog";

export type PopulationObservation = {
	areaCode: string;
	/**
	 * The code the publisher supplied when a reviewed, code-only correction
	 * changes `areaCode` to the declared source partition. Absent for ordinary
	 * observations, whose served and publisher codes are the same.
	 */
	sourceAreaCode?: string;
	value: number;
	/**
	 * `observed` is a value the publisher reported. `derived` is one this API
	 * computed from other measures, and no publisher is answerable for it.
	 */
	status: "observed" | "derived";
	/**
	 * The publisher's interval around this value, where one is published. The
	 * measure's `uncertainty` says what kind of interval it is.
	 */
	confidenceInterval?: { lower: number; upper: number };
};

/** A source-reported label, intentionally distinct from a numeric value. */
export type CategoricalObservation = {
	areaCode: string;
	/** See PopulationObservation.sourceAreaCode. */
	sourceAreaCode?: string;
	category: string;
	status: "observed";
};

export type MeasureObservation = PopulationObservation | CategoricalObservation;

export const isNumericObservation = (
	record: MeasureObservation,
): record is PopulationObservation => "value" in record;

/** A measure's observations for one source partition, one block per period. */
export type MeasureObservationArtifact<
	T extends MeasureObservation = PopulationObservation,
> = {
	schemaVersion: 1;
	contentHash: string;
	measureId: string;
	sourceGeography: SourceGeography;
	periods: Array<{ period: string; records: T[] }>;
};

export type AnyMeasureObservationArtifact =
	| MeasureObservationArtifact
	| MeasureObservationArtifact<CategoricalObservation>;

/**
 * The SQLite artifact identity holding one measure source's
 * observations: `{measure-id}-observations`, unless the source names its own
 * because the measure has several.
 */
export const observationArtifactName = (
	measureId: string,
	source: MeasureSource,
) => source.observationArtifact ?? `${measureId}-observations`;

/** The artifact holding a measure source's observations. */
export const findMeasureObservations = (
	artifacts: AnyMeasureObservationArtifact[],
	measureId: string,
	source: MeasureSource,
) =>
	artifacts.find(
		(candidate) =>
			candidate.measureId === measureId &&
			candidate.sourceGeography.type === source.sourceGeography.type &&
			candidate.sourceGeography.boundaryYear ===
				source.sourceGeography.boundaryYear,
	);
