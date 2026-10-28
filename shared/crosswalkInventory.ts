import type { GeographyKind } from "@uk-data-atlas/geography";

export type CrosswalkMethod =
	| "official-lookup"
	| "clean-containment"
	| "area-overlap"
	| "population-overlap"
	| "geometric-containment"
	| "best-fit"
	| "extent-continuity";
export type CrosswalkQuality = "publisher-supplied" | "derived";
export type PropertyRelationshipPurpose = "identity" | "membership";
export type AreaOverlapWeighting = {
	status: "provided";
	basis: "area";
	normalisation: "per-source";
};
/**
 * Weights from resident population rather than land: each source's people,
 * counted from fine building blocks split by area, divided among its targets.
 * The denominator and its date travel with every weighted answer.
 */
export type PopulationOverlapWeighting = {
	status: "provided";
	basis: "population";
	normalisation: "per-source";
	/** What was counted, such as Census 2021 usual residents. */
	population: string;
	/** The reference date of the count. */
	date: string;
	/** The building blocks the count was published for. */
	blocks: { geography: GeographyKind; boundaryRelease: string };
};
export type CrosswalkWeighting =
	| { status: "not-provided" }
	| { status: "not-applicable" }
	| AreaOverlapWeighting
	| PopulationOverlapWeighting;

/** How many of a compiled release's areas a crosswalk relates to another. */
export type ReleaseCoverage = {
	geography: string;
	boundaryRelease: string;
	areaCount: number;
	relatedAreaCount: number;
};

export type CrosswalkInventory = {
	schemaVersion: 1;
	/** Of the schema version and the crosswalks, not of `releaseCoverage`. */
	contentHash: string;
	crosswalks: Array<{
		id: string;
		from: { geography: string; boundaryRelease: string };
		to: { geography: string; boundaryRelease: string };
		method: CrosswalkMethod;
		quality: CrosswalkQuality;
		relationshipPurpose?: "identity" | "membership";
		weighting: CrosswalkWeighting;
		recordCount: number;
		artifact: string;
		contentHash: string;
	}>;
	/**
	 * How many areas of each compiled release the crosswalks relate, counted
	 * at build time so that reporting it for every release does not read every
	 * crosswalk. Counted against the area inventory it names, so it is used
	 * only while that is the inventory in hand.
	 */
	releaseCoverage?: {
		areaInventoryHash: string;
		releases: ReleaseCoverage[];
	};
};
