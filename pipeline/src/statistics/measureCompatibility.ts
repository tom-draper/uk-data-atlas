import type { AreaReleaseArtifact } from "@uk-data-atlas/areas";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { releaseKey } from "@uk-data-atlas/geography";
import {
	type DataCatalog,
	type AnyMeasureObservationArtifact,
	type MeasureSource,
} from "@uk-data-atlas/catalogue/node";
import {
	measureSeriesKey,
	measureSeriesSourceKey,
} from "@uk-data-atlas/measures";
import { sha256 } from "@uk-data-atlas/artifacts";
import {
	type CompatibilityCandidate,
	type CompatibilityStatus,
	type MeasureCompatibilityInventory,
} from "@uk-data-atlas/catalogue/node";

const sample = (codes: Set<string>) => [...codes].sort().slice(0, 20);

/**
 * Every area code the source partition holds, in any of its periods. A code
 * that appears only in a later period still has to resolve for a join to be
 * safe, so no single period stands in for the partition.
 */
const sourceCodes = (
	measureId: string,
	source: MeasureSource,
	observations: AnyMeasureObservationArtifact | undefined,
) => {
	const periods = observations?.periods;
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
	candidate: ReadonlySet<string>,
	release: BoundaryRegistry["releases"][number],
): CompatibilityCandidate => {
	const unmatchedSource = new Set(
		[...source].filter((code) => !candidate.has(code)),
	);
	const matchingCodeCount = source.size - unmatchedSource.size;
	const candidateOnlyCodeCount = candidate.size - matchingCodeCount;
	const candidateOnlyCodeSample: string[] = [];
	// Candidate codes are already sorted, so only visit enough to fill the sample.
	if (candidateOnlyCodeCount > 0) {
		const sampleSize = Math.min(20, candidateOnlyCodeCount);
		for (const code of candidate) {
			if (!source.has(code)) candidateOnlyCodeSample.push(code);
			if (candidateOnlyCodeSample.length === sampleSize) break;
		}
	}
	const status: CompatibilityStatus =
		unmatchedSource.size === 0 && candidateOnlyCodeCount === 0
			? "exact-code-set"
			: unmatchedSource.size === 0
				? "code-set-compatible"
				: matchingCodeCount === 0
					? "no-code-overlap"
					: "partial-code-overlap";
	return {
		boundaryRelease: release.id,
		title: release.title,
		coverageCountries: release.coverage.countries,
		status,
		sourceCodeCount: source.size,
		candidateCodeCount: candidate.size,
		matchingCodeCount,
		matchedSourceShare: matchingCodeCount / source.size,
		unmatchedSourceCodeCount: unmatchedSource.size,
		unmatchedSourceCodeSample: sample(unmatchedSource),
		candidateOnlyCodeCount,
		candidateOnlyCodeSample,
	};
};

export const compileMeasureCompatibility = (
	dataCatalog: DataCatalog,
	boundaryRegistry: BoundaryRegistry,
	areaArtifacts: AreaReleaseArtifact[],
	measureObservations:
		| ReadonlyMap<string, AnyMeasureObservationArtifact>
		| ((
				measureId: string,
				source: MeasureSource,
				seriesKey: string,
		  ) => AnyMeasureObservationArtifact),
): MeasureCompatibilityInventory => {
	if (dataCatalog.measures.length === 0) {
		throw new Error("Data catalogue has no measures.");
	}
	const codesByRelease = new Map(
		areaArtifacts.map((artifact) => [
			releaseKey(artifact.geography, artifact.boundaryRelease),
			new Set(artifact.areas.map((area) => area.code).sort()),
		]),
	);
	const observationHashes = new Map<string, string>(
		typeof measureObservations === "function"
			? []
			: Array.from(measureObservations, ([key, artifact]) => [
					key,
					artifact.contentHash,
				]),
	);
	const sourcesFor = (measure: (typeof dataCatalog.measures)[number]) =>
		measure.sources.map((source) => {
			if (!measure.series)
				throw new Error(`Missing series identity for ${measure.id}.`);
			const key = measureSeriesSourceKey(measure.series, source);
			const observations =
				typeof measureObservations === "function"
					? measureObservations(
							measure.id,
							source,
							measureSeriesKey(measure.series),
						)
					: measureObservations.get(key);
			if (observations)
				observationHashes.set(key, observations.contentHash);
			const codes = sourceCodes(measure.id, source, observations);
			const candidates = boundaryRegistry.releases
				.filter(
					(release) =>
						release.geography === source.sourceGeography.type &&
						release.temporalCoverage ===
							String(source.sourceGeography.boundaryYear),
				)
				.flatMap((release) => {
					const candidate = codesByRelease.get(
						releaseKey(release.geography, release.id),
					);
					return candidate
						? [candidateFor(codes, candidate, release)]
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
	const measures = dataCatalog.measures.map((measure) => {
		const identity = measure.series;
		if (!identity)
			throw new Error(`Missing series identity for ${measure.id}.`);
		return {
			measureId: measure.id,
			seriesKey: measureSeriesKey(identity),
			sources: sourcesFor(measure),
		};
	});
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
				releaseKey(artifact.geography, artifact.boundaryRelease),
				artifact.contentHash,
			])
			.sort(([left], [right]) => left.localeCompare(right)),
	);
	const inputs = {
		dataCatalog: dataCatalog.contentHash,
		boundaryRegistry: boundaryRegistry.contentHash,
		// Keyed by partition: a measure published at several source
		// geographies has one artifact for each, and each must be recorded.
		measureObservations: Object.fromEntries(
			[...observationHashes].sort(([left], [right]) =>
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
