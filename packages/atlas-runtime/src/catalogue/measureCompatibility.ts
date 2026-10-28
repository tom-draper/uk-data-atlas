import type {
	DataCatalog,
	AnyMeasureObservationArtifact,
	MeasureSource,
} from "./dataCatalog";

/**
 * How a source partition's codes stand against a boundary release. Only the
 * first two mean every source code is present, which is what a geometry join
 * requires.
 */
export const COMPATIBILITY_STATUSES = [
	"exact-code-set",
	"code-set-compatible",
	"partial-code-overlap",
	"no-code-overlap",
] as const;

export type CompatibilityStatus = (typeof COMPATIBILITY_STATUSES)[number];

export type CompatibilityCandidate = {
	boundaryRelease: string;
	title: string;
	coverageCountries: string[];
	status: CompatibilityStatus;
	sourceCodeCount: number;
	candidateCodeCount: number;
	matchingCodeCount: number;
	matchedSourceShare: number;
	unmatchedSourceCodeCount: number;
	unmatchedSourceCodeSample: string[];
	candidateOnlyCodeCount: number;
	candidateOnlyCodeSample: string[];
};

export type MeasureCompatibilitySource = {
	datasetId: MeasureSource["datasetId"];
	sourceGeography: MeasureSource["sourceGeography"];
	periods: string[];
	candidates: CompatibilityCandidate[];
	note: string;
};

export type MeasureCompatibilityInventory = {
	schemaVersion: 1;
	contentHash: string;
	inputs: {
		dataCatalog: string;
		boundaryRegistry: string;
		areaArtifacts: Record<string, string>;
	};
	measures: Array<{
		measureId: string;
		sources: MeasureCompatibilitySource[];
	}>;
};

/** Published boundary code-set compatibility candidates for one measure. */
export const measureCompatibilityReport = (
	inventory: MeasureCompatibilityInventory,
	measureId: string,
) => {
	const measure = inventory.measures.find(
		(candidate) => candidate.measureId === measureId,
	);
	return (
		measure && {
			...measure,
			note: "Candidates report code-set compatibility only. They do not select a geometry release or assert equal geometry.",
		}
	);
};

type Measure = DataCatalog["measures"][number];

/** What a measure publishes for one source partition, as routes report it. */
export const publishedSourcePartition = (
	source: Measure["sources"][number],
) => ({
	datasetId: source.datasetId,
	boundaryYear: source.sourceGeography.boundaryYear,
	periods: source.periods,
	coverage: source.coverage,
});

/** Every partition a measure publishes for one geography. */
export const publishedSourcePartitionsFor = (
	measure: Measure,
	geography: string,
) =>
	measure.sources
		.filter((source) => source.sourceGeography.type === geography)
		.map(publishedSourcePartition);

/**
 * The partition a compatibility summary was compiled from. The summary keeps
 * only the identity of its source, so the measure is asked for the rest
 * rather than a route reaching into the catalogue itself.
 */
export const publishedSourcePartitionOf = (
	measure: Measure,
	source: MeasureCompatibilitySource,
) => {
	const published = measure.sources.find(
		(candidate) =>
			candidate.datasetId === source.datasetId &&
			candidate.sourceGeography.type === source.sourceGeography.type &&
			candidate.sourceGeography.boundaryYear ===
				source.sourceGeography.boundaryYear,
	);
	return published ? publishedSourcePartition(published) : undefined;
};

/** The key a measure's observation artifact is recorded under in `inputs`. */
export const observationPartitionKey = ({
	measureId,
	sourceGeography,
}: Pick<AnyMeasureObservationArtifact, "measureId" | "sourceGeography">) =>
	`${measureId}/${sourceGeography.type}/${sourceGeography.boundaryYear}`;
