import type { Measure, MeasureSource } from "./dataCatalog";
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

/** The published artifact a response's values were read from. */
export type ObservationArtifactReference = {
	/** The artifact's file name under /v1, without its extension. */
	artifact: string;
	contentHash: string;
};

type SourceExactProvenanceInput = {
	atlasRelease: string;
	measure: Measure;
	source: MeasureSource;
	period: string;
	observations: ObservationArtifactReference;
	geometry?: CallerSelectedGeometry;
};

type SourceSeriesProvenanceInput = Omit<
	SourceExactProvenanceInput,
	"period"
> & {
	periods: string[];
};

const provenanceBase = ({
	atlasRelease,
	measure,
	source,
	geometry,
}: Omit<SourceExactProvenanceInput, "period" | "observations">) => ({
	atlasRelease: {
		id: atlasRelease,
		href: "/v1/atlas-release",
	},
	measure: {
		id: measure.id,
		href: `/v1/measures/${measure.id}`,
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
	...provenanceBase({ atlasRelease, measure, source, geometry }),
	source: {
		dataset: {
			id: source.datasetId,
			href: `/v1/datasets/${source.datasetId}`,
		},
		observations: {
			artifact: observations.artifact,
			contentHash: observations.contentHash,
			period,
		},
	},
});

/** Provenance for a set of source-exact observations across multiple periods. */
export const sourceSeriesProvenance = ({
	atlasRelease,
	measure,
	source,
	periods,
	observations,
	geometry,
}: SourceSeriesProvenanceInput) => ({
	...provenanceBase({ atlasRelease, measure, source, geometry }),
	source: {
		dataset: {
			id: source.datasetId,
			href: `/v1/datasets/${source.datasetId}`,
		},
		observations: {
			artifact: observations.artifact,
			contentHash: observations.contentHash,
			periods,
		},
	},
});
