import {
	readArchivedAtlasReleaseArtifact,
	readArchivedAtlasReleases,
	readAtlasReleaseArtifact,
} from "./atlasReleaseHistory";
import type { AtlasRelease } from "./atlasRelease";
import type { RouteContext } from "./routing";

export type AtlasReleaseHistory = Map<string, AtlasRelease>;

export const readAtlasReleaseHistory = (
	publicDirectory: string,
	currentRelease: AtlasRelease,
): AtlasReleaseHistory =>
	new Map(
		[...readArchivedAtlasReleases(publicDirectory), currentRelease].map(
			(release) => [release.releaseId, release],
		),
	);

/** Read an exact artifact from the current or archived immutable release. */
export const createReleaseArtifactReader =
	(
		publicDirectory: string,
		currentRelease: AtlasRelease,
		releaseHistory: AtlasReleaseHistory,
	): NonNullable<RouteContext["readReleaseArtifact"]> =>
	(requestedReleaseId, artifactId) => {
		const release = releaseHistory.get(requestedReleaseId);
		if (!release) return undefined;
		return requestedReleaseId === currentRelease.releaseId
			? readAtlasReleaseArtifact(publicDirectory, release, artifactId)
			: readArchivedAtlasReleaseArtifact(
					publicDirectory,
					release,
					artifactId,
				);
	};
