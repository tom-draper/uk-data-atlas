import type { NamedLocationGeometry } from "./geometryTypes";

/**
 * What a named location is. An official kind is an area ONS defines, with its
 * members taken from the ONS lookup in `source`; a `ceremonial-county` is a
 * county lord-lieutenants are appointed to, with its members worked out from
 * Ordnance Survey's boundaries (see ceremonialCounties.ts), and a
 * `historic-county` likewise from its historic counties;
 * `editorial-grouping` is a curated set that claims no official status.
 */
export type NamedLocationKind =
	| "editorial-grouping"
	| "country"
	| "region"
	| "combined-authority"
	| "county"
	| "ceremonial-county"
	| "historic-county";

export type NamedLocation = {
	id: string;
	label: string;
	kind: NamedLocationKind;
	/**
	 * For an official kind, the ONS lookup its current members come from; for
	 * a ceremonial county, the boundaries they were worked out from.
	 */
	source?:
		| {
				publisher: "Office for National Statistics";
				/** Directory under data/lookups in the Atlas repository. */
				lookup: string;
				code: string;
		  }
		| {
				publisher: "Ordnance Survey";
				dataset: string;
				edition: string;
				/** The county's name in that dataset. */
				name: string;
				method: string;
		  };
	/** Revision of this definition in the curated gazetteer. */
	definitionRevision: number;
	/** The geography whose codes define this editorial grouping. */
	memberGeography: string;
	/** Every source-area assertion, with its own known effective interval. */
	memberAssertions?: Array<{
		code: string;
		validity: { from: string | null; to: string | null };
	}>;
	/** All codes in the definition. Use `membersAt` to select a date. */
	memberCodes: string[];
	/** Known temporal bounds of the definition; null means the source gives none. */
	validity: { from: string | null; to: string | null };
	bbox: [number, number, number, number];
	/**
	 * Areas only partly in this location, with the share that is. A member
	 * is counted whole where most of it lies, so its other part is listed on
	 * the location that holds it rather than summed twice.
	 */
	partialMembers?: Array<{
		code: string;
		share: number;
		memberOf: string;
	}>;
	/** A build-time union of members from one fully resolved boundary release. */
	geometry?: NamedLocationGeometry;
};

export type NamedLocationInventory = {
	schemaVersion: 1;
	contentHash: string;
	source: {
		artifact: "data/datasets/gazetteer.core.json";
		gazetteerVersion: number;
	};
	locations: NamedLocation[];
};
