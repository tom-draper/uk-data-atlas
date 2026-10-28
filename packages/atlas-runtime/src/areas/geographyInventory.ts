import type {
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkWeighting,
} from "@uk-data-atlas/relationships";

export type GeographyRelationship = {
	id: string;
	direction: "from" | "to";
	counterpart: { geography: string; boundaryRelease: string };
	method: CrosswalkMethod;
	quality: CrosswalkQuality;
	weighting: CrosswalkWeighting;
};

export type GeographyReleaseInventory = {
	id: string;
	geography: string;
	countries: string[];
	inputFormats: string[];
	areaIdentities:
		| {
				status: "available";
				recordCount: number;
				artifact: string;
		  }
		| {
				status: "unsupported";
				reason: string;
		  };
	relationships:
		| {
				status: "available";
				crosswalks: GeographyRelationship[];
		  }
		| {
				status: "unsupported";
				reason: string;
		  };
};

export type GeographyInventory = {
	schemaVersion: 1;
	contentHash: string;
	boundaryRegistryHash: string;
	releases: GeographyReleaseInventory[];
	geographies: Array<{
		id: string;
		countries: string[];
		releaseCount: number;
		/** A compiled backlog for completing this geography's resolver support. */
		capabilities: {
			areaIdentities: {
				availableReleaseCount: number;
				unsupportedReleaseCount: number;
				availableAreaCount: number;
			};
			relationships: {
				availableReleaseCount: number;
				unsupportedReleaseCount: number;
				crosswalkCount: number;
			};
		};
	}>;
};
