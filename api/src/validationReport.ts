export const VALIDATION_CHECKS = [
	"registry-links",
	"release-coverage",
	"licence-recorded",
	"area-identities",
	"geometry-servable",
	"candidates-reviewed",
	"artifact-integrity",
	"endpoints-verified",
	"source-names-consistent",
	"targets-present",
	"single-parent",
	"weights-sum-to-one",
	"area-coverage",
	"sliver-separation",
	"same-code-extent",
	"population-coverage",
	"containment-verified",
	"measure-definition",
	"records-resolve",
	"countries-declared",
	"values-valid",
	"components-sum-to-total",
] as const;

export type ValidationCheckId = (typeof VALIDATION_CHECKS)[number];

export type ValidationCheck = {
	id: ValidationCheckId;
	status: "passed" | "waived";
	/** What the check found; present on every waived check. */
	detail?: string;
	measured?: Record<string, number | string | null>;
	waiver?: { reason: string };
};

export type ValidationResource = {
	id: string;
	/**
	 * A `measure-source` is one source partition of a measure, identified by
	 * the export that serves its observation artifact.
	 */
	kind:
		| "atlas"
		| "boundary-release"
		| "crosswalk"
		| "measure"
		| "measure-source";
	status: "passed" | "waived";
	checks: ValidationCheck[];
};

export type ValidationReport = {
	schemaVersion: 1;
	contentHash: string;
	inputs: Record<string, string>;
	summary: {
		resourceCount: number;
		checkCount: number;
		passedCount: number;
		waivedCount: number;
		coverage: {
			boundaryReleases: number;
			areaIdentities: number;
			servableGeometry: number;
			withRelationships: number;
			crosswalks: number;
			weightedCrosswalks: number;
			measures: number;
			measureSources: number;
		};
	};
	resources: ValidationResource[];
};
