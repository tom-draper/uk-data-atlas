export type PostcodeCounts = {
	/** Unit postcodes with no termination date in this ONS directory edition. */
	live: number;
	/** Unit postcodes with a termination date in this ONS directory edition. */
	terminated: number;
	/** Live unit postcodes marked as large-user postcodes. */
	largeUser: number;
	edition: string;
};

export type PostcodeCountsArtifact = {
	schemaVersion: 1;
	contentHash: string;
	postcodeIndex: string;
	postcodeAreas: string;
	releases: Array<{
		geography: string;
		boundaryRelease: string;
		/** Counts are omitted for areas with no postcode centroids. */
		areas: Record<string, Omit<PostcodeCounts, "edition">>;
	}>;
};
