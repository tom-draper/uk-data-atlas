import type { DataCatalog, PopulationSource } from "./dataCatalog";
import type {
	CompatibilityCandidate,
	MeasureCompatibilityInventory,
} from "./measureCompatibility";

const isEligibleForCodeJoin = (candidate: CompatibilityCandidate) =>
	(candidate.status === "exact-code-set" ||
		candidate.status === "code-set-compatible") &&
	candidate.unmatchedSourceCodeCount === 0 &&
	candidate.matchedSourceShare === 1;

const sameSource = (
	left: PopulationSource,
	right: {
		datasetId: PopulationSource["datasetId"];
		sourceGeography: PopulationSource["sourceGeography"];
		periods: string[];
	},
) =>
	left.datasetId === right.datasetId &&
	left.sourceGeography.type === right.sourceGeography.type &&
	left.sourceGeography.boundaryYear === right.sourceGeography.boundaryYear &&
	left.periods.join(",") === right.periods.join(",");

/**
 * Present source coverage and boundary code coverage together without turning
 * a code-set match into a claim of geometric equivalence. The compatibility
 * inventory remains the detailed diagnostic source; this report is the
 * concise, decision-oriented view used by API consumers.
 */
export const measureCoverage = (
	dataCatalog: DataCatalog,
	measureCompatibilityInventory: MeasureCompatibilityInventory,
	measureId: string,
) => {
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure) return undefined;
	const compatibility = measureCompatibilityInventory.measures.find(
		(candidate) => candidate.measureId === measureId,
	);
	return {
		measure: {
			id: measure.id,
			valueKind: measure.valueKind,
			unit: measure.unit,
			availability: measure.availability,
			href: `/v1/measures/${measure.id}`,
		},
		sources: measure.sources.map((source) => {
			const assessedSource = compatibility?.sources.find((candidate) =>
				sameSource(source, candidate),
			);
			return {
				dataset: {
					id: source.datasetId,
					href: `/v1/datasets/${source.datasetId}`,
				},
				periods: source.periods,
				sourceGeography: source.sourceGeography,
				sourceCoverage: source.coverage,
				boundaryCoverage: assessedSource
					? assessedSource.candidates.map((candidate) => ({
							boundaryRelease: candidate.boundaryRelease,
							title: candidate.title,
							coverageCountries: candidate.coverageCountries,
							status: candidate.status,
							sourceAreaCount: candidate.sourceCodeCount,
							boundaryAreaCount: candidate.candidateCodeCount,
							matchingSourceAreaCount:
								candidate.matchingCodeCount,
							matchingSourceAreaShare:
								candidate.matchedSourceShare,
							unmatchedSourceAreaCount:
								candidate.unmatchedSourceCodeCount,
							candidateOnlyAreaCount:
								candidate.candidateOnlyCodeCount,
							eligibleForCodeJoin:
								isEligibleForCodeJoin(candidate),
						}))
					: [],
				assessment:
					assessedSource === undefined
						? {
								status: "not-assessed" as const,
								note: "No boundary code-coverage assessment has been published for this source partition.",
							}
						: {
								status: "assessed" as const,
								href: `/v1/measures/${measure.id}/compatibility`,
								note: "Boundary coverage compares area-code membership only; it does not assert equal geometry.",
							},
			};
		}),
	};
};
