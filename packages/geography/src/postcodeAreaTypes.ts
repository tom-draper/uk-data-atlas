/**
 * The areas every postcode's centroid falls in, compiled for the boundary
 * releases postcode answers read most: the releases a default lookup selects
 * at the directory's edition, the release each measure source's codes are
 * found in, and the country release that settles a postcode matching nothing.
 *
 * A live lookup reads a whole release's geometry, some hundreds of megabytes,
 * to place one point. Here the build places every postcode once, by the same
 * containment test and the same distance to the nearest edge, so a postcode
 * answer reads a few kilobytes and loads no geometry. A release this index
 * does not hold is still answered live.
 *
 * Shards follow the postcode index's districts and align with its shards
 * position by position; each records the hash of the postcode shard it was
 * compiled against, and the manifest records every input it was compiled
 * from, so a stale index is refused rather than served.
 */
export type PostcodeAreasArtifact = {
	schemaVersion: 1;
	contentHash: string;
	/** The postcode index whose centroids were placed. */
	postcodeIndex: string;
	releases: PostcodeAreaRelease[];
	/** Sorted by district. */
	shards: Array<{ district: string; path: string; contentHash: string }>;
};

export type PostcodeAreaPurpose =
	"default-lookup" | "measure-source" | "country";

export type PostcodeAreaRelease = {
	geography: string;
	boundaryRelease: string;
	/** Why the release is compiled. */
	purposes: PostcodeAreaPurpose[];
	/** The area release artifact's content hash. */
	areaRelease: string;
	/** The raw geometry's SHA-256, as the geometry source registry records it. */
	geometryInput: string;
	counts: {
		/** Postcodes whose centroid lies in at least one area. */
		placed: number;
		/** Postcodes with a centroid lying in no area. */
		unplaced: number;
		/** Postcodes on an edge, or in more than one area. */
		several: number;
	};
};

/** One release's placements for one district, a column per field. */
export type PostcodeAreaColumn = {
	/** The area codes the district's postcodes fall in, sorted. */
	codes: string[];
	/**
	 * For each postcode, the position in `codes` of the one area whose
	 * interior holds it; NONE where no area does or it has no centroid, and
	 * SEVERAL where `several` lists its areas.
	 */
	area: number[];
	/** Hundredths of a metre from the centroid to that area's nearest edge. */
	distanceCm: number[];
	/** By postcode position: each area as [code position, containment, distance]. */
	several?: Record<string, Array<[number, "interior" | "boundary", number]>>;
};

export type PostcodeAreasShard = {
	schemaVersion: 1;
	district: string;
	/** The content hash of the postcode shard these columns align with. */
	postcodeShard: string;
	/** Keyed by `{geography}/{boundaryRelease}`. */
	releases: Record<string, PostcodeAreaColumn>;
};

export const NONE = -1;
export const SEVERAL = -2;

export const releaseKey = (geography: string, boundaryRelease: string) =>
	`${geography}/${boundaryRelease}`;
