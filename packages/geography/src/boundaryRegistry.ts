import type { BoundaryReleaseDeprecation } from "./boundaryReleaseDeprecations.ts";

export type BoundarySource = {
	publisher: string;
	url: string;
	retrievedAt?: string;
	licence: {
		name: string;
		url?: string;
	};
};

/** A verified inclusive interval for a specified use, not a guessed snapshot span. */
export type BoundaryValidity = {
	purpose: "election_poll";
	validFrom: string;
	validTo: string;
	sourceUrl: string;
	note: string;
};

export type BoundaryRelease = {
	id: string;
	geography: string;
	title: string;
	description?: string;
	temporalCoverage?: string;
	validity?: BoundaryValidity[];
	coverage: {
		countries: string[];
	};
	source: BoundarySource;
	metadataHash: string;
	/** Present when the release is superseded and due to be retired. */
	deprecation?: BoundaryReleaseDeprecation;
};

export type BoundaryRegistry = {
	schemaVersion: 1;
	contentHash: string;
	releases: BoundaryRelease[];
};
