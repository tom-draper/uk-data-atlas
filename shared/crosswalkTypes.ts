import type {
	AreaOverlapWeighting,
	BestFitCrosswalkAdapter,
	CoverageException,
	GeometricContainmentCrosswalkAdapter,
	IndeterminatePairs,
	PopulationOverlapWeighting,
	PropertyCrosswalkAdapter,
	ExtentContinuityCrosswalkAdapter,
} from "./crosswalkAdapters";
import type { CrosswalkEndpointValidation } from "./crosswalkEndpointValidation";
import type { GeometryContainmentValidation } from "@uk-data-atlas/geography";
import type { GeometryProvenance } from "@uk-data-atlas/geography";

export type CrosswalkArea = {
	code: string;
	labels: string[];
};

export type AreaOverlapSource = CrosswalkArea & {
	areaM2: number;
	/** Share of the source's area covered by its published targets. */
	coverage: number;
};

export type AreaOverlapTarget = CrosswalkArea & {
	/** Share of the source's covered area; a record's weights sum to 1. */
	weight: number;
	overlapAreaM2: number;
	/** Overlap area as a share of the whole source area. */
	sourceShare: number;
	/** Overlap area as a share of the whole target area. */
	targetShare: number;
};

export type AreaOverlapValidation = {
	candidatePairCount: number;
	intersectingPairCount: number;
	sliverPairCount: number;
	/** Pairs kept by the adapter's `indeterminatePairs` decision. */
	indeterminateOverlapPairCount?: number;
	sliverWidthM: number;
	widestSliverWidthM: number | null;
	narrowestOverlapWidthM: number;
	minimumCoverage: number;
	/** The declared target coverage threshold when it differs from the source's. */
	minimumTargetCoverageRequired?: number;
	minimumSourceCoverage: number;
	minimumTargetCoverage: number;
};

type CrosswalkEndpoints = {
	from: CrosswalkEndpointValidation;
	to: CrosswalkEndpointValidation;
};

type CrosswalkArtifactBase = {
	schemaVersion: 1;
	contentHash: string;
	id: string;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	relationshipPurpose?: "identity" | "membership";
};

export type PropertyCrosswalkArtifact = CrosswalkArtifactBase & {
	method: PropertyCrosswalkAdapter["method"];
	quality: PropertyCrosswalkAdapter["quality"];
	weighting: PropertyCrosswalkAdapter["weighting"];
	provenance: {
		input: string;
		inputHash: string;
		corrections?: Array<{
			sourceCode: string;
			publishedTargetCode: string;
			correctedTargetCode: string;
			reason: string;
		}>;
	};
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		/** Independent geometry check for published clean-containment mappings. */
		geometryContainment?: GeometryContainmentValidation;
		/** Pairs by the publisher's change indicator, where it gives one. */
		changes?: Record<CrosswalkChange, number>;
	};
	records: Array<{
		source: CrosswalkArea;
		targets: Array<CrosswalkArea & { change?: CrosswalkChange }>;
	}>;
};

/**
 * How the publisher says a code became its successor: kept whole, split into
 * several, merged with others, or redistributed in a way that is neither.
 */
export type CrosswalkChange = "unchanged" | "split" | "merged" | "complex";

export type AreaOverlapCrosswalkArtifact = CrosswalkArtifactBase & {
	method: "area-overlap";
	quality: "derived";
	weighting: AreaOverlapWeighting;
	provenance: {
		inputs: Array<
			{
				side: "from" | "to";
				input: string;
				inputHash: string;
				sourceCodePattern?: string;
			} & GeometryProvenance
		>;
		excludedPairs?: Record<string, Record<string, string>>;
		includedPairs?: Record<string, Record<string, string>>;
		indeterminatePairs?: IndeterminatePairs;
		coverageExceptions?: Record<string, CoverageException>;
		areaProjection: "EPSG:6933";
		clipping: string;
		/** Version of the worker protocol used for bounded clipping. */
		boundedClipping?: number;
	};
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		overlap: AreaOverlapValidation;
	};
	records: Array<{ source: AreaOverlapSource; targets: AreaOverlapTarget[] }>;
};

export type PopulationOverlapValidation = {
	minimumCoverage: number;
	blockCount: number;
	/** Every block's count, and where it went: kept pairs, slivers, outside. */
	blockPopulation: number;
	assignedPopulation: number;
	/** People in a source but in no kept pair: where borders disagree. */
	sliverPopulation: number;
	/** People in blocks outside every source the adapter admits. */
	outsidePopulation: number;
	/** Blocks the clipper could not measure, and their population. */
	unmeasuredBlocks: Array<{
		code: string;
		population: number;
		reason: string;
	}>;
	minimumSourceCoverage: number;
};

export type PopulationOverlapCrosswalkArtifact = CrosswalkArtifactBase & {
	method: "population-overlap";
	quality: "derived";
	weighting: PopulationOverlapWeighting;
	provenance: {
		pairs: { crosswalkId: string; contentHash: string };
		inputs: AreaOverlapCrosswalkArtifact["provenance"]["inputs"];
		blocks: { input: string; inputHash: string } & GeometryProvenance;
		population: {
			input: string;
			inputHash: string;
			codeColumn: string;
			valueColumn: string;
		};
		areaProjection: "EPSG:6933";
		clipping: string;
		boundedClipping?: number;
	};
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		population: PopulationOverlapValidation;
	};
	records: Array<{
		source: CrosswalkArea & {
			population: number;
			/** Share of the source's population in its published targets. */
			coverage: number;
		};
		targets: Array<
			CrosswalkArea & {
				/** Share of the source's covered population; weights sum to 1. */
				weight: number;
				population: number;
				/** The pair's population as a share of the source's. */
				sourceShare: number;
				/** The pair's population as a share of the target's, from every source. */
				targetShare: number;
				/** The pair's area, from the area-overlap crosswalk it reweights. */
				overlapAreaM2: number;
			}
		>;
	}>;
};

export type GeometricContainmentValidation = {
	sliverWidthM: number;
	childCount: number;
	parentCount: number;
	childlessParentCount: number;
	/** The smallest share of any child's area inside its parent. */
	minimumContainedShare: number;
	/** The widest piece any child leaves outside its parent, in metres. */
	widestOutsideM: number;
};

export type GeometricContainmentCrosswalkArtifact = CrosswalkArtifactBase & {
	method: "geometric-containment";
	quality: "derived";
	relationshipPurpose: "membership";
	weighting: GeometricContainmentCrosswalkAdapter["weighting"];
	provenance: AreaOverlapCrosswalkArtifact["provenance"];
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		containment: GeometricContainmentValidation;
	};
	records: Array<{
		source: CrosswalkArea;
		targets: Array<
			CrosswalkArea & {
				/** Share of the child's area inside this parent. */
				containedShare: number;
				/** Width of the widest piece it leaves outside, in metres. */
				outsideWidthM: number;
			}
		>;
	}>;
};

export type ExtentContinuityValidation = {
	sliverWidthM: number;
	/**
	 * How a shared code's difference wider than slivers is judged: by the
	 * widest piece another area of the other release holds, since the rest,
	 * such as coast one generalised outline includes and the other leaves
	 * out, moves no boundary between areas.
	 */
	differenceRule: "claimed-by-another-area";
	sourceAreaCount: number;
	targetAreaCount: number;
	/** Codes present in both releases, whether or not published. */
	sharedCodeCount: number;
	/** Shared codes whose extent held, published as same-code records. */
	continuousCount: number;
	/**
	 * Shared codes left out because their geometries differ by more than
	 * slivers: `changed` beyond twice the sliver width, `indeterminate` within
	 * a factor of two of it, where the build will not decide.
	 */
	changedExtent: Array<{
		code: string;
		relation: "changed" | "indeterminate";
		/** Width of the difference's widest piece, twice area over perimeter. */
		widestDifferenceM: number;
		/** Width of the widest piece of it another area holds. */
		claimedDifferenceM: number;
		sourceShare: number;
		targetShare: number;
	}>;
	/** Shared codes the clipper could not intersect, so not published. */
	unmeasured: Array<{ code: string; reason: string }>;
	/**
	 * Codes only one release holds, paired where their extents match to
	 * within how far the published same-code pairs drift.
	 */
	recoded: RecodedExtentComparison;
	/** The share of each other a realigned pair must both keep. */
	realignedShare: number;
	/**
	 * Pairs whose extent moved by more than noise, but so little that each
	 * keeps at least `realignedShare` of the other, choosing only each other:
	 * a ward redrawn by a street, under its code or a new one. Not identity,
	 * so no conversion follows them; the resolver's `successorArea` does, to
	 * carry an area's history on to the area that succeeded it.
	 */
	realigned: Array<{
		code: string;
		successor: string;
		match: "same-code" | "recoded";
		widestDifferenceM: number;
		sourceShare: number;
		targetShare: number;
	}>;
};

export type RecodedExtentComparison =
	| {
			status: "compared";
			/**
			 * The widest difference a recoded pair may have: the one 99% of the
			 * published same-code pairs stay within.
			 */
			widthCeilingM: number;
			/** The published same-code pairs that ceiling was measured from. */
			noiseSampleCount: number;
			/** Codes only the first release holds. */
			retiredCodeCount: number;
			/** Codes only the second release holds. */
			introducedCodeCount: number;
			/** Recoded pairs published, each choosing only the other. */
			matchedCount: number;
			/** Codes within the ceiling of more than one code, so not published. */
			ambiguous: Array<{ code: string; candidates: string[] }>;
			/**
			 * Pairs wider than the ceiling but under half the sliver width, such
			 * as a small realignment released under a new code. Not published.
			 */
			nearMisses: Array<{
				code: string;
				candidate: string;
				widestDifferenceM: number;
				sourceShare: number;
				targetShare: number;
			}>;
			unmeasured: Array<{
				code: string;
				candidate: string;
				reason: string;
			}>;
	  }
	| { status: "not-compared"; reason: string };

export type ExtentContinuityCrosswalkArtifact = CrosswalkArtifactBase & {
	method: "extent-continuity";
	quality: "derived";
	relationshipPurpose: "identity";
	weighting: ExtentContinuityCrosswalkAdapter["weighting"];
	provenance: AreaOverlapCrosswalkArtifact["provenance"];
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		continuity: ExtentContinuityValidation;
	};
	records: Array<{
		source: CrosswalkArea;
		targets: Array<
			CrosswalkArea & {
				/**
				 * Whether the area kept its code, or carries on under a new one
				 * with the same extent.
				 */
				match: "same-code" | "recoded";
				/** Width of the difference's widest piece, in metres. */
				widestDifferenceM: number;
				/**
				 * Where the difference is wider than slivers, the width of the
				 * widest piece of it another area holds, which is what was
				 * judged: the rest is coast or estuary one outline draws.
				 */
				claimedDifferenceM?: number;
				/** Overlap as a share of the source area. */
				sourceShare: number;
				/** Overlap as a share of the target area. */
				targetShare: number;
			}
		>;
	}>;
};

export type BestFitValidation = {
	sliverWidthM: number;
	childCount: number;
	parentCount: number;
	/** Children that sit within their best-fit parent, as containment judges it. */
	withinCount: number;
	/** Children within a factor of two of the sliver width, where no rule decides. */
	indeterminateCount: number;
	/** Children that genuinely straddle, placed with the parent holding most of them. */
	straddlingCount: number;
	/** The smallest share of any child's area inside its best-fit parent. */
	minimumContainedShare: number;
};

export type BestFitCrosswalkArtifact = CrosswalkArtifactBase & {
	method: "best-fit";
	quality: "derived";
	weighting: BestFitCrosswalkAdapter["weighting"];
	provenance: AreaOverlapCrosswalkArtifact["provenance"];
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		bestFit: BestFitValidation;
	};
	records: Array<{
		source: CrosswalkArea;
		targets: Array<
			CrosswalkArea & {
				/** Share of the child's area inside this parent, the largest of any. */
				containedShare: number;
				/** The widest piece of the child left outside this parent, in metres. */
				outsideWidthM: number;
				relation: "within" | "indeterminate" | "straddles";
			}
		>;
	}>;
};

export type CrosswalkArtifact =
	| PropertyCrosswalkArtifact
	| AreaOverlapCrosswalkArtifact
	| PopulationOverlapCrosswalkArtifact
	| GeometricContainmentCrosswalkArtifact
	| BestFitCrosswalkArtifact
	| ExtentContinuityCrosswalkArtifact;
