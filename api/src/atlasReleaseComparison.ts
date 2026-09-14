import type { AtlasRelease, AtlasReleaseArtifactRef } from "./atlasRelease";

type ChangedArtifact = {
	id: string;
	from: AtlasReleaseArtifactRef;
	to: AtlasReleaseArtifactRef;
};

export const compareAtlasReleases = (from: AtlasRelease, to: AtlasRelease) => {
	const fromById = new Map(
		from.artifacts.map((artifact) => [artifact.id, artifact]),
	);
	const toById = new Map(
		to.artifacts.map((artifact) => [artifact.id, artifact]),
	);
	const added = to.artifacts.filter((artifact) => !fromById.has(artifact.id));
	const removed = from.artifacts.filter(
		(artifact) => !toById.has(artifact.id),
	);
	const changed: ChangedArtifact[] = to.artifacts.flatMap((artifact) => {
		const previous = fromById.get(artifact.id);
		return previous && previous.contentHash !== artifact.contentHash
			? [{ id: artifact.id, from: previous, to: artifact }]
			: [];
	});
	const unchanged = to.artifacts.filter(
		(artifact) =>
			fromById.get(artifact.id)?.contentHash === artifact.contentHash,
	);
	return {
		from: {
			releaseId: from.releaseId,
			href: `/v1/atlas-releases/${from.releaseId}`,
		},
		to: {
			releaseId: to.releaseId,
			href: `/v1/atlas-releases/${to.releaseId}`,
		},
		summary: {
			added: added.length,
			removed: removed.length,
			changed: changed.length,
			unchanged: unchanged.length,
		},
		artifacts: { added, removed, changed },
		note: "This is an immutable manifest-level changelog. It identifies changed published artifacts by hash; it does not infer record-level changes from those hashes.",
	};
};
