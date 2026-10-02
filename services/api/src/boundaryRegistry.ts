export type BoundarySource = {
	publisher: string;
	url: string;
	retrievedAt?: string;
	licence: {
		name: string;
		url?: string;
	};
};

export type BoundaryRelease = {
	id: string;
	geography: string;
	title: string;
	description?: string;
	temporalCoverage?: string;
	coverage: {
		countries: string[];
	};
	source: BoundarySource;
	metadataHash: string;
};

export type BoundaryRegistry = {
	schemaVersion: 1;
	contentHash: string;
	releases: BoundaryRelease[];
};
