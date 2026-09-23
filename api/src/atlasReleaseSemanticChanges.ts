import type { AtlasRelease, ResourceKind } from "./atlasRelease";
import type { ResourceChanges } from "./atlasReleaseComparison";
import { releaseKey } from "./geographyKeys";

type JsonRecord = Record<string, unknown>;

export type SemanticResourceChange = {
	kind: ResourceKind;
	id: string;
	/**
	 * Dot paths in the published resource entry whose value changed. These are
	 * entry metadata paths, never paths inside an observation record.
	 */
	fields: string[];
};

export type SemanticReleaseChanges =
	| { status: "available"; changes: SemanticResourceChange[] }
	| { status: "unavailable"; reason: string };

type ReadArtifact = (
	releaseId: string,
	artifactId: string,
) => { body: Buffer } | undefined;

const artifactForKind: Record<ResourceKind, string> = {
	datasets: "data-catalog",
	measures: "data-catalog",
	boundaryReleases: "boundary-registry",
	areaIdentities: "area-inventory",
	geometrySources: "geometry-sources",
	crosswalks: "crosswalk-inventory",
	validationExceptions: "validation-report",
	namedLocations: "named-locations",
	exports: "export-manifest",
	lookups: "lookup-manifest",
	terrainLayers: "terrain-catalogue",
};

const entries = (value: unknown, key: string): JsonRecord[] => {
	const entries = (value as JsonRecord | null)?.[key];
	return Array.isArray(entries)
		? entries.filter(
				(entry): entry is JsonRecord =>
					typeof entry === "object" && entry !== null,
			)
		: [];
};

const identity = (entry: JsonRecord) =>
	releaseKey(String(entry.geography), String(entry.id));

const resource = (
	kind: ResourceKind,
	id: string,
	artifact: unknown,
): JsonRecord | undefined => {
	switch (kind) {
		case "datasets":
			return entries(artifact, "datasets").find((entry) => entry.id === id);
		case "measures":
			return entries(artifact, "measures").find((entry) => entry.id === id);
		case "boundaryReleases":
		case "areaIdentities":
			return entries(artifact, "releases").find(
				(entry) => identity(entry) === id,
			);
		case "geometrySources":
			return entries(artifact, "releases").find((entry) => entry.id === id);
		case "crosswalks":
			return entries(artifact, "crosswalks").find((entry) => entry.id === id);
		case "namedLocations":
			return entries(artifact, "locations").find((entry) => entry.id === id);
		case "exports":
			return entries(artifact, "exports").find((entry) => entry.id === id);
		case "lookups":
			return entries(artifact, "lookups").find((entry) => entry.id === id);
		case "terrainLayers":
			return entries(artifact, "products").find(
				(entry) => entry.id === id,
			);
		case "validationExceptions": {
			for (const entry of entries(artifact, "resources"))
				for (const check of entries(entry, "checks"))
					if (
						check.status === "waived" &&
						`${String(entry.id)} ${String(check.id)}` === id
					)
						return {
							detail: check.detail,
							waiver: check.waiver,
						};
			return undefined;
		}
	}
};

const same = (left: unknown, right: unknown) =>
	JSON.stringify(left) === JSON.stringify(right);

/**
 * Name fields rather than return their values. A changed array is deliberately
 * one field: resource metadata arrays frequently contain ordered source inputs
 * or periods, and treating their elements as records would overstate what the
 * comparison knows.
 */
const changedFields = (
	from: JsonRecord,
	to: JsonRecord,
	prefix = "",
	into = new Set<string>(),
): string[] => {
	for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
		// Each resource fingerprint already exposes the fact that its content
		// changed. Repeating its derived digest says nothing about the semantic
		// change a sync client needs to handle.
		if (key === "contentHash") continue;
		const path = prefix ? `${prefix}.${key}` : key;
		const before = from[key];
		const after = to[key];
		if (same(before, after)) continue;
		if (
			typeof before === "object" &&
			before !== null &&
			!Array.isArray(before) &&
			typeof after === "object" &&
			after !== null &&
			!Array.isArray(after)
		) {
			changedFields(before as JsonRecord, after as JsonRecord, path, into);
		} else {
			into.add(path);
		}
	}
	return [...into].sort();
};

const changedIds = (change: ResourceChanges) =>
	change.status === "compared" ? change.changed : [];

/**
 * Resolves changed resource fingerprints back to their archived, published
 * entries. It is intentionally limited to resource metadata: an observation
 * export changing is reported as an export entry changing, not as guessed row
 * additions, removals or value revisions.
 */
export const semanticReleaseChanges = (
	from: AtlasRelease,
	to: AtlasRelease,
	resources: Record<ResourceKind, ResourceChanges>,
	readArtifact: ReadArtifact | undefined,
): SemanticReleaseChanges => {
	if (!readArtifact)
		return {
			status: "unavailable",
			reason:
				"This API instance cannot read the retained release artifacts needed for field-level comparison.",
		};
	const changes: SemanticResourceChange[] = [];
	for (const [kind, comparison] of Object.entries(resources) as Array<
		[ResourceKind, ResourceChanges]
	>) {
		const ids = changedIds(comparison);
		if (ids.length === 0) continue;
		const artifactId = artifactForKind[kind];
		const beforeBytes = readArtifact(from.releaseId, artifactId)?.body;
		const afterBytes = readArtifact(to.releaseId, artifactId)?.body;
		if (!beforeBytes || !afterBytes)
			return {
				status: "unavailable",
				reason: `The retained ${artifactId} artifact is unavailable for one or both releases, so ${kind} cannot be compared by field.`,
			};
		let beforeArtifact: unknown;
		let afterArtifact: unknown;
		try {
			beforeArtifact = JSON.parse(beforeBytes.toString("utf8"));
			afterArtifact = JSON.parse(afterBytes.toString("utf8"));
		} catch {
			return {
				status: "unavailable",
				reason: `The retained ${artifactId} artifact is not valid JSON for one or both releases.`,
			};
		}
		for (const id of ids) {
			const before = resource(kind, id, beforeArtifact);
			const after = resource(kind, id, afterArtifact);
			if (!before || !after)
				return {
					status: "unavailable",
					reason: `The ${kind} fingerprint for ${id} does not resolve to a published entry in both retained artifacts.`,
				};
			changes.push({ kind, id, fields: changedFields(before, after) });
		}
	}
	return {
		status: "available",
		changes: changes.sort(
			(left, right) =>
				left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id),
		),
	};
};
