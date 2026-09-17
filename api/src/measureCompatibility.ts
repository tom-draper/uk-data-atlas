import { createHash } from "node:crypto";
import type { AreaReleaseArtifact } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import {
	type DataCatalog,
	findMeasureObservations,
	isLegacyPopulationSource,
	AnyMeasureObservationArtifact,
	MeasureSource,
	PopulationLocalAuthorityObservationArtifact,
	PopulationObservationArtifact,
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
		populationObservations: string;
		populationLocalAuthorityObservations: string;
		areaArtifacts: Record<string, string>;
	};
	measures: Array<{
		measureId: string;
		sources: MeasureCompatibilitySource[];
	}>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const sample = (codes: Set<string>) => [...codes].sort().slice(0, 20);

/**
 * Every area code the source partition holds, in any of its periods. A code
 * that appears only in a later period still has to resolve for a join to be
 * safe, so no single period stands in for the partition.
 */
const sourceCodes = (
	measureId: string,
	source: MeasureSource,
	wardObservations: PopulationObservationArtifact,
	localAuthorityObservations: PopulationLocalAuthorityObservationArtifact,
	measureObservations: AnyMeasureObservationArtifact[],
) => {
	if (
		isLegacyPopulationSource(measureId, source) &&
		source.sourceGeography.type === "ward"
	) {
		return new Set(
			wardObservations.records.map((record) => record.areaCode),
		);
	}
	const periods = isLegacyPopulationSource(measureId, source)
		? localAuthorityObservations.periods
		: findMeasureObservations(measureObservations, measureId, source)
				?.periods;
	const codes = new Set<string>();
	for (const period of source.periods) {
		const records = periods?.find(
			(candidate) => candidate.period === period,
		)?.records;
		if (!records) {
			throw new Error(
				`No ${measureId} observations exist for ${source.sourceGeography.type} in ${period}.`,
			);
		}
		for (const record of records) codes.add(record.areaCode);
	}
	return codes;
};

const candidateFor = (
	source: Set<string>,
	artifact: AreaReleaseArtifact,
	release: BoundaryRegistry["releases"][number],
): CompatibilityCandidate => {
	const candidate = new Set(artifact.areas.map((area) => area.code));
	const unmatchedSource = new Set(
		[...source].filter((code) => !candidate.has(code)),
	);
	const candidateOnly = new Set(
		[...candidate].filter((code) => !source.has(code)),
	);
	const matchingCodeCount = source.size - unmatchedSource.size;
	const status: CompatibilityStatus =
		unmatchedSource.size === 0 && candidateOnly.size === 0
			? "exact-code-set"
			: unmatchedSource.size === 0
				? "code-set-compatible"
				: matchingCodeCount === 0
					? "no-code-overlap"
					: "partial-code-overlap";
	return {
		boundaryRelease: artifact.boundaryRelease,
		title: release.title,
		coverageCountries: release.coverage.countries,
		status,
		sourceCodeCount: source.size,
		candidateCodeCount: candidate.size,
		matchingCodeCount,
		matchedSourceShare: matchingCodeCount / source.size,
		unmatchedSourceCodeCount: unmatchedSource.size,
		unmatchedSourceCodeSample: sample(unmatchedSource),
		candidateOnlyCodeCount: candidateOnly.size,
		candidateOnlyCodeSample: sample(candidateOnly),
	};
};

/**
 * Compare an observation source's code set with compiled boundary identities.
 * This deliberately establishes code compatibility only: a matching code set
 * says nothing about whether two releases have identical geometry.
 */
/** The key a measure's observation artifact is recorded under in `inputs`. */
export const observationPartitionKey = ({
	measureId,
	sourceGeography,
}: Pick<AnyMeasureObservationArtifact, "measureId" | "sourceGeography">) =>
	`${measureId}/${sourceGeography.type}/${sourceGeography.boundaryYear}`;

export const compileMeasureCompatibility = (
	dataCatalog: DataCatalog,
	boundaryRegistry: BoundaryRegistry,
	areaArtifacts: AreaReleaseArtifact[],
	wardObservations: PopulationObservationArtifact,
	localAuthorityObservations: PopulationLocalAuthorityObservationArtifact,
	measureObservations: AnyMeasureObservationArtifact[],
): MeasureCompatibilityInventory => {
	if (dataCatalog.measures.length === 0) {
		throw new Error("Data catalogue has no measures.");
	}
	const artifactsByIdentity = new Map(
		areaArtifacts.map((artifact) => [
			`${artifact.geography}/${artifact.boundaryRelease}`,
			artifact,
		]),
	);
	const sourcesFor = (measure: (typeof dataCatalog.measures)[number]) =>
		measure.sources.map((source) => {
			const codes = sourceCodes(
				measure.id,
				source,
				wardObservations,
				localAuthorityObservations,
				measureObservations,
			);
			const candidates = boundaryRegistry.releases
				.filter(
					(release) =>
						release.geography === source.sourceGeography.type &&
						release.temporalCoverage ===
							String(source.sourceGeography.boundaryYear),
				)
				.flatMap((release) => {
					const artifact = artifactsByIdentity.get(
						`${release.geography}/${release.id}`,
					);
					return artifact
						? [candidateFor(codes, artifact, release)]
						: [];
				})
				.sort((left, right) =>
					left.boundaryRelease.localeCompare(right.boundaryRelease),
				);
			return {
				datasetId: source.datasetId,
				sourceGeography: source.sourceGeography,
				periods: source.periods,
				candidates,
				note: "This is code-set compatibility only, based on area-code membership. It does not select a boundary release or claim that compatible releases have equal geometry.",
			};
		});
	const measures = dataCatalog.measures.map((measure) => ({
		measureId: measure.id,
		sources: sourcesFor(measure),
	}));
	const sources = measures.flatMap((measure) => measure.sources);
	const compatibleArtifacts = areaArtifacts.filter((artifact) =>
		sources.some(
			(source) =>
				source.sourceGeography.type === artifact.geography &&
				source.candidates.some(
					(candidate) =>
						candidate.boundaryRelease === artifact.boundaryRelease,
				),
		),
	);
	const areaArtifactHashes = Object.fromEntries(
		compatibleArtifacts
			.map((artifact) => [
				`${artifact.geography}/${artifact.boundaryRelease}`,
				artifact.contentHash,
			])
			.sort(([left], [right]) => left.localeCompare(right)),
	);
	const inputs = {
		dataCatalog: dataCatalog.contentHash,
		boundaryRegistry: boundaryRegistry.contentHash,
		populationObservations: wardObservations.contentHash,
		populationLocalAuthorityObservations:
			localAuthorityObservations.contentHash,
		// Keyed by partition: a measure published at several source
		// geographies has one artifact for each, and each must be recorded.
		measureObservations: Object.fromEntries(
			measureObservations
				.map((observations) => [
					observationPartitionKey(observations),
					observations.contentHash,
				])
				.sort(([left], [right]) =>
					String(left).localeCompare(String(right)),
				),
		),
		areaArtifacts: areaArtifactHashes,
	};
	return {
		schemaVersion: 1,
		contentHash: sha256(
			JSON.stringify({ schemaVersion: 1, inputs, measures }),
		),
		inputs,
		measures,
	};
};
