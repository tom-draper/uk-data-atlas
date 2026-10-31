/**
 * The parts of the API's responses the fix page reads. They mirror
 * `services/api/openapi.yaml` for `/areas:validate`, `/boundary-releases` and
 * `/areas/{geography}/{release}/{code}/history`, and name only the fields the
 * page uses.
 */

export interface ReleaseRef {
	geography: string;
	boundaryRelease: string;
}

export type CodeStatus =
	| "valid"
	| "superseded"
	| "not-yet-current"
	| "absent-from-release"
	| "other-geography"
	| "unknown"
	| "malformed-code";

export type NameStatus = "matched" | "ambiguous" | "unmatched";

export type ValueStatus = CodeStatus | NameStatus;

export interface ValidatedArea {
	id: string;
	code: string;
	name: string;
}

export interface ValidatedValue {
	index: number;
	value: string;
	kind: "code" | "name";
	status: ValueStatus;
	area?: ValidatedArea;
	normalised?: string[];
	duplicateOf?: number;
	detail?: string;
	presentIn?: { boundaryRelease: string; name: string }[];
	heldBy?: { geography: string; boundaryReleases: string[] }[];
	candidates?: (ValidatedArea & { match?: string })[];
	matchesIn?: { boundaryRelease: string }[];
	parent?: { value: string; area?: ValidatedArea };
}

export interface ValidationSummary {
	valueCount: number;
	byStatus: Partial<Record<ValueStatus, number>>;
	duplicateCount: number;
	normalisedCount: number;
	joinable: boolean;
}

export interface ValidationManifest {
	atlasRelease?: string;
	input?: { sha256?: string };
}

/** `/areas:validate` with no release: the API ranks releases itself. */
export interface InferredValidation {
	likely?: ReleaseRef & {
		resolved: number;
		summary: ValidationSummary;
		tiedWith?: ReleaseRef[];
	};
	values: ValidatedValue[];
	verdict: string;
	manifest?: ValidationManifest;
}

/** `/areas:validate` against one exact release. */
export interface ExactValidation extends ReleaseRef {
	summary: ValidationSummary;
	values: ValidatedValue[];
	manifest?: ValidationManifest;
}

export interface BoundaryRelease {
	id: string;
	geography: string;
	title: string;
	coverage?: { countries?: string[] };
}

export interface LineageEntry {
	relation: string;
	depth: number;
	from: string;
	counterpart: {
		id: string;
		geography: string;
		boundaryRelease: string;
		code: string;
		labels?: string[];
	};
}

export interface AreaHistory {
	id: string;
	lineage: LineageEntry[];
}

/** One entry of `/crosswalks`. */
export interface Crosswalk {
	id: string;
	from: ReleaseRef;
	to: ReleaseRef;
	method: string;
	/** The published artifact, which `/lookups` names as its source. */
	artifact: string;
}

/** One entry of `/lookups`, a whole table to download. */
export interface BulkLookup {
	id: string;
	kind: string;
	source: { artifact: string };
	formats: { csv?: { href: string; bytes: number } };
}
