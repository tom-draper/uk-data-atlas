/**
 * What changed between two Atlas releases, worked out by the client.
 *
 * The API keeps no history: it serves the current release only. Its manifest,
 * `GET /v1/atlas-release`, records a fingerprint for every dataset, measure,
 * boundary release, crosswalk, named location, export, lookup and so on, and
 * a fingerprint changes exactly when that resource's published entry does.
 * So a consumer that keeps the manifest it last synced can compare it with
 * the current one and fetch only what moved, with nothing held server side.
 */
export type AtlasReleaseManifest = {
	releaseId: string;
	resources?: Record<string, Record<string, string>>;
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
	before: Record<string, string>,
	after: Record<string, string>,
): ResourceChanges => {
	const ids = (record: Record<string, string>) => Object.keys(record).sort();
	return {
		status: "compared",
		added: ids(after).filter((id) => !(id in before)),
		removed: ids(before).filter((id) => !(id in after)),
		changed: ids(after).filter(
			(id) => id in before && before[id] !== after[id],
		),
		unchanged: ids(after).filter((id) => before[id] === after[id]).length,
	};
};

/**
 * Compare the manifest a consumer kept with the current one, kind by kind.
 * With no previous manifest, a first sync, every resource is added. A kind
 * one manifest does not record is `not-recorded` rather than reported as
 * wholly added or removed.
 */
export const compareReleases = (
	previous: AtlasReleaseManifest | undefined,
	current: AtlasReleaseManifest,
): Record<string, ResourceChanges> => {
	const kinds = new Set([
		...Object.keys(previous?.resources ?? {}),
		...Object.keys(current.resources ?? {}),
	]);
	return Object.fromEntries(
		[...kinds].sort().map((kind) => {
			const before = previous ? previous.resources?.[kind] : {};
			const after = current.resources?.[kind];
			return [
				kind,
				before && after
					? compareFingerprints(before, after)
					: {
							status: "not-recorded",
							reason: `${before ? current.releaseId : previous!.releaseId} does not record ${kind}.`,
						},
			];
		}),
	);
};

/**
 * The downloads a sync must take and drop for one kind, such as `exports` or
 * `lookups`. A kind that could not be compared is taken whole, since nothing
 * shows which of its resources are current.
 */
export const syncPlan = (
	changes: Record<string, ResourceChanges>,
	current: AtlasReleaseManifest,
	kind: string,
) => {
	const compared = changes[kind];
	if (!compared || compared.status === "not-recorded")
		return {
			fetch: Object.keys(current.resources?.[kind] ?? {}).sort(),
			drop: [],
		};
	return {
		fetch: [...compared.added, ...compared.changed].sort(),
		drop: compared.removed,
	};
};
