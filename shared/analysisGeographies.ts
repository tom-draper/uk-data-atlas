import type { CrosswalkMethod, CrosswalkQuality } from "./crosswalkInventory";
import type { RelationshipPath } from "./relationshipPaths";
import type { GeographyKind } from "@uk-data-atlas/geography";

export type AnalysisGeographySupport = {
	measureId: string;
	analysisGeography: { geography: string; boundaryRelease: string };
	source: {
		datasetId: string;
		geography: string;
		boundaryYear: number;
		periods: string[];
	};
	/** The reviewed crosswalk, when the conversion is one crosswalk. */
	crosswalk?: CrosswalkSummary;
	/** The reviewed published path, when the conversion composes several. */
	path?: AnalysisGeographyPath;
	note: string;
};

export type CrosswalkSummary = {
	id: string;
	method: CrosswalkMethod;
	quality: CrosswalkQuality;
};

export type AnalysisGeographyPath = {
	id: string;
	purpose: RelationshipPath["purpose"];
	origin: RelationshipPath["origin"];
	quality: RelationshipPath["quality"];
	steps: Array<{
		crosswalk: CrosswalkSummary;
		direction: RelationshipPath["steps"][number]["direction"];
	}>;
};

export type AnalysisGeographyInventory = {
	schemaVersion: 1;
	contentHash: string;
	dataCatalogHash: string;
	crosswalkInventoryHash: string;
	/** Present only when a support converts through a published path. */
	relationshipPathInventoryHash?: string;
	supports: AnalysisGeographySupport[];
};

export type AnalysisGeographySupportConfig = {
	measureId: string;
	analysisGeography: { geography: GeographyKind; boundaryRelease: string };
	source: {
		datasetId: string;
		geography: GeographyKind;
		boundaryYear: number;
	};
	/** Exactly one of a crosswalk and a published relationship path. */
	crosswalkId?: string;
	pathId?: string;
	note: string;
};
