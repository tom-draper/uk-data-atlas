import {
	type AtlasRelease,
	type AtlasReleaseArtifactRef,
	RESOURCE_KINDS,
	type ResourceKind,
} from "./atlasRelease";

type ChangedArtifact = {
	id: string;
	from: AtlasReleaseArtifactRef;
	to: AtlasReleaseArtifactRef;
};

export type ResourceChanges =
	| {
			status: "compared";
			added: string[];
			removed: string[];
			changed: string[];
			unchanged: number;
	  }
	| { status: "not-recorded"; reason: string };

const compareFingerprints = (
	from: Record<string, string>,
	to: Record<string, string>,
): ResourceChanges => {
	const ids = (record: Record<string, string>) => Object.keys(record).sort();
	return {
		status: "compared",
		added: ids(to).filter((id) => !(id in from)),
		removed: ids(from).filter((id) => !(id in to)),
		changed: ids(to).filter((id) => id in from && from[id] !== to[id]),
		unchanged: ids(to).filter((id) => from[id] === to[id]).length,
	};
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
	const missing = [from, to]
		.filter((release) => !release.resources)
		.map((release) => release.releaseId);
	const resources = Object.fromEntries(
		RESOURCE_KINDS.map((kind): [ResourceKind, ResourceChanges] => {
			const before = from.resources?.[kind];
			const after = to.resources?.[kind];
			return [
				kind,
				before && after
					? compareFingerprints(before, after)
					: {
							status: "not-recorded",
							reason:
								missing.length > 0
									? `${missing.join(" and ")} ${missing.length === 1 ? "was" : "were"} archived before resource fingerprints were recorded.`
									: `One release does not record ${kind}.`,
						},
			];
		}),
	) as Record<ResourceKind, ResourceChanges>;
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
		resources,
		note: "Artifacts are compared by content hash. Resources inside them, such as datasets, crosswalks and validation exceptions, are compared by the fingerprints each release recorded when it was built; a changed resource differs somewhere in its published entry, and the comparison does not say which field.",
	};
};
