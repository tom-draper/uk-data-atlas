/**
 * The compiled postcode index: every unit postcode in the ONS Postcode
 * Directory, with the grid reference of its centroid, how that centroid was
 * placed and when the postcode was in use.
 *
 * It records where a postcode is, not which areas it falls in. Areas come
 * from testing the centroid against the Atlas's own boundary releases, so a
 * postcode resolves into every geography and vintage the Atlas holds, by the
 * same method and with the same caveats as any other point.
 *
 * Runtime records live in atlas.sqlite. The reader reconstructs one district
 * (the outward code, such as SW1A) on first use and caches a bounded number.
 * The manifest retains each district's original content hash and ordering,
 * preserving postcode-to-area joins and refusing changed district records.
 */
export type PostcodeIndexArtifact = {
	schemaVersion: 1;
	contentHash: string;
	source: PostcodeSource;
	/** Postcode areas the directory holds and this index deliberately omits. */
	excluded: Array<{ area: string; postcodes: number; reason: string }>;
	counts: {
		postcodes: number;
		live: number;
		terminated: number;
		withoutGridReference: number;
	};
	/** Sorted by district. */
	shards: Array<{
		district: string;
		path: string;
		postcodes: number;
		contentHash: string;
	}>;
};

export type PostcodeSource = {
	title: string;
	/** The directory's edition, as YYYY-MM. */
	edition: string;
	publisher: string;
	sourceUrl: string;
	retrieved: string;
	/** The SHA-256 of the permitted, filtered source file. */
	sha256: string;
	licence: { name: string; url: string };
	/** Statements the licence requires wherever the data is used. */
	attribution: string[];
};

/**
 * One postcode district, stored column by column: position `i` of every
 * column describes `postcodes[i]`.
 */
export type PostcodeShard = {
	schemaVersion: 1;
	district: string;
	/** Compact unit postcodes such as "AB10AA", sorted by code unit. */
	postcodes: string[];
	/** Easting then northing in whole metres for each postcode, or null twice. */
	grid: Array<number | null>;
	/** The directory's positional quality indicator, one digit per postcode. */
	quality: string;
	/** The first letter of the directory's country code, one per postcode. */
	country: string;
	/** Introduction month as YYYYMM. */
	introduced: number[];
	/** Termination month as YYYYMM, or 0 while the postcode is live. */
	terminated: number[];
	/** "1" where the postcode serves a single large user. */
	largeUser: string;
};
