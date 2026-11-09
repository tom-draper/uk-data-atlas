/** Why and how a boundary release is being retired. */
export type BoundaryReleaseDeprecation = {
	/** The date (YYYY-MM-DD) the release was deprecated. */
	deprecated: string;
	/** The date (YYYY-MM-DD) after which the release may be removed. */
	sunset?: string;
	/** The id of the release, of the same geography, to use instead. */
	replacedBy: string;
	reason: string;
};

/**
 * Superseded boundary releases, keyed by `geography/release`. Source metadata
 * is immutable, so a release is retired here; the boundary registry build
 * copies the record onto the release. A deprecated release stays published
 * until its sunset date has passed and a maintainer removes it.
 */
export const boundaryReleaseDeprecations: Readonly<
	Record<string, BoundaryReleaseDeprecation>
> = {
	"lsoa/2001-12-ew-bgc": {
		deprecated: "2026-10-26",
		replacedBy: "2001-12-ew-bgc-v2",
		reason: "This release was thinned to meet an obsolete file-size limit, which collapsed small polygon parts. 2001-12-ew-bgc-v2 is the publisher's unthinned geometry.",
	},
};
