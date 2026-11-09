export type AtlasReleaseArtifactRef = {
	id: string;
	/** On-disk path relative to the repository root. */
	path: string;
	contentHash: string;
};

/** Identifies the files served by the current build. No history is retained. */
export type AtlasRelease = {
	schemaVersion: 1;
	releaseId: string;
	artifacts: AtlasReleaseArtifactRef[];
};
