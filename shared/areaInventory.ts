export type AreaSourceAdapter = {
	source: {
		geography: string;
		boundaryRelease: string;
	};
	filter: {
		property: string;
		startsWith: string;
	};
};

export type AreaRecord = {
	code: string;
	name: string;
	aliases?: string[];
};

export type AreaReleaseArtifact = {
	schemaVersion: 1;
	contentHash: string;
	geography: string;
	boundaryRelease: string;
	codeProperty: string;
	nameProperty: string;
	derivedFrom?: AreaSourceAdapter;
	areas: AreaRecord[];
};

type AvailableAreaRelease = {
	id: string;
	geography: string;
	status: "available";
	recordCount: number;
	artifact: string;
	contentHash: string;
	codeProperty: string;
	nameProperty: string;
	derivedFrom?: AreaSourceAdapter;
};

export type UnavailableAreaRelease = {
	id: string;
	geography: string;
	status: "not-compiled";
	reason: string;
};

export type AreaInventory = {
	schemaVersion: 1;
	contentHash: string;
	boundaryRegistryHash: string;
	releases: Array<AvailableAreaRelease | UnavailableAreaRelease>;
};

export type AreaLookup = Map<string, Map<string, AreaRecord>>;
