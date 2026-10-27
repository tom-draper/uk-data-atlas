export type EvidenceDocument = {
	id: string;
	artifact: string;
	bytes: number;
	contentHash: string;
};
export type EvidenceManifest = {
	schemaVersion: 1;
	contentHash: string;
	dataCatalogHash: string;
	documents: EvidenceDocument[];
};
