import type { Indexed } from "@uk-data-atlas/search-index";

export type CompiledPlace = {
	/**
	 * A reference that does not depend on a release: `localAuthority/E08000003`
	 * for an area, `location/north-west` for a curated location.
	 */
	place: string;
	kind: "area" | "named-location";
	geography: string;
	code: string;
	/** The name in the newest release carrying the code. */
	name: string;
	/**
	 * Positions in `releases` of the releases carrying this code, ascending
	 * and so newest first. Empty for a named location.
	 */
	boundaryReleases: number[];
	memberCodes?: string[];
	memberAssertions?: Array<{
		code: string;
		validity: { from: string | null; to: string | null };
	}>;
	memberGeography?: string;
	definitionRevision?: number;
	validity?: { from: string | null; to: string | null };
};

/**
 * One label a name was indexed from: the position of its place in `places`,
 * 1 when the name was reached by setting an administrative title aside, and
 * the label itself when it is not the place's name.
 */
export type CompiledPlaceLabel = [number, 0 | 1] | [number, 0 | 1, string];

export type PlaceIndexArtifact = {
	schemaVersion: 1;
	contentHash: string;
	/** The `NAME_NORMALISATION` fingerprint `names` were normalised under. */
	nameNormalisation: string;
	areaInventoryHash: string;
	namedLocationInventoryHash: string | null;
	/** Every boundary release id a place carries, newest first. */
	releases: string[];
	/** Sorted by `place`. */
	places: CompiledPlace[];
	/** Every normalised name, sorted, for exact and prefix search. */
	names: string[];
	/** The labels behind each of `names`, position for position. */
	labels: CompiledPlaceLabel[][];
	/** Every area code, sorted, for a query that is a bare code. */
	codes: string[];
	/** The places carrying each of `codes`, position for position. */
	codePlaces: number[][];
};

/**
 * What a search reads from the index: the artifact itself, or its tables in
 * SQLite, as the server reads it.
 */
export type PlaceIndex = {
	releases: readonly string[];
	places: Indexed<CompiledPlace>;
	names: Indexed<string>;
	labels: Indexed<CompiledPlaceLabel[]>;
	codes: Indexed<string>;
	codePlaces: Indexed<number[]>;
};

/** The shape of a code a query can name directly: E08000003. */
export const AREA_CODE = /^[A-Z]\d{8}$/;

export const placeReference = (
	kind: "area" | "named-location",
	geography: string,
	code: string,
) => (kind === "named-location" ? `location/${code}` : `${geography}/${code}`);
