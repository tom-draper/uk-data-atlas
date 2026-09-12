import type {
	PopulationLocalAuthorityObservationArtifact,
	PopulationMeasure,
	PopulationObservationArtifact,
	PopulationSource,
} from "./dataCatalog";
import type { CompatibilityStatus } from "./measureCompatibility";

export type CallerSelectedGeometry = {
	boundaryRelease: string;
	selection: "caller-specified";
	compatibility: Extract<
		CompatibilityStatus,
		"exact-code-set" | "code-set-compatible"
	>;
	areaIdentityTemplate: string;
	note: string;
};

type SourceExactProvenanceInput = {
	atlasRelease: string;
	measure: PopulationMeasure;
	source: PopulationSource;
	period: string;
	observations:
		| PopulationObservationArtifact
		| PopulationLocalAuthorityObservationArtifact;
	geometry?: CallerSelectedGeometry;
};

/**
 * Describe the immutable artifacts and geographic interpretation behind a
 * source-exact response. This is deliberately data-level metadata: repeating
 * publisher and hash information for every observation would be noisy and
 * make pagination needlessly expensive.
 */
export const sourceExactProvenance = ({
	atlasRelease,
	measure,
	source,
	period,
	observations,
	geometry,
}: SourceExactProvenanceInput) => ({
	atlasRelease: {
		id: atlasRelease,
		href: "/v1/atlas-release",
	},
	measure: {
		id: measure.id,
		href: `/v1/measures/${measure.id}`,
	},
	source: {
		dataset: {
			id: source.datasetId,
			href: `/v1/datasets/${source.datasetId}`,
		},
		observations: {
			artifact:
				source.sourceGeography.type === "ward"
					? "population-observations"
					: "population-local-authority-observations",
			contentHash: observations.contentHash,
			period,
		},
	},
	geography: {
		source: source.sourceGeography,
		match:
			geometry === undefined
				? {
						status: "no-boundary-release-selected" as const,
						note: "The published observations declare a geography type and code vintage, but not a boundary release.",
					}
				: {
						status: "caller-selected-code-join" as const,
						boundaryRelease: geometry.boundaryRelease,
						compatibility: geometry.compatibility,
						href: `/v1/measures/${measure.id}/compatibility`,
						note: geometry.note,
					},
	},
	transformation: {
		status: "not-applied" as const,
		note: "Values are served source-exact; no geographic conversion or aggregation was applied.",
	},
});
