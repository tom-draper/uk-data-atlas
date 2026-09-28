import assert from "node:assert/strict";
import test from "node:test";
import { type AtlasRelease, RESOURCE_KINDS } from "../src/atlasRelease";
import { compareAtlasReleases } from "../src/atlasReleaseComparison";
import { semanticReleaseChanges } from "../src/atlasReleaseSemanticChanges";

test("compares immutable release artifacts without inferring record changes", () => {
	const comparison = compareAtlasReleases(
		{
			schemaVersion: 1,
			releaseId: "sha256:before",
			artifacts: [
				{
					id: "data-catalog",
					path: "data-catalog.json",
					contentHash: "sha256:one",
				},
				{
					id: "named-locations",
					path: "named-locations.json",
					contentHash: "sha256:two",
				},
			],
		},
		{
			schemaVersion: 1,
			releaseId: "sha256:after",
			artifacts: [
				{
					id: "data-catalog",
					path: "data-catalog.json",
					contentHash: "sha256:three",
				},
				{
					id: "crosswalks",
					path: "crosswalks.json",
					contentHash: "sha256:four",
				},
			],
		},
	);
	assert.deepEqual(comparison.summary, {
		added: 1,
		removed: 1,
		changed: 1,
		unchanged: 0,
	});
	assert.deepEqual(
		comparison.artifacts.changed.map((entry) => entry.id),
		["data-catalog"],
	);
	assert.deepEqual(comparison.resources.crosswalks, {
		status: "not-recorded",
		reason: "sha256:before and sha256:after were archived before resource fingerprints were recorded.",
	});
});

const empty = () =>
	Object.fromEntries(RESOURCE_KINDS.map((kind) => [kind, {}])) as NonNullable<
		AtlasRelease["resources"]
	>;

test("names the datasets, crosswalks and exceptions that changed between releases", () => {
	type Resources = NonNullable<AtlasRelease["resources"]>;
	const before: Resources = {
		...empty(),
		datasets: { crime: "sha256:a", jobs: "sha256:b" },
		crosswalks: { "ward-to-lad": "sha256:c" },
		validationExceptions: {
			"exports/house-price-median-observations records-resolve":
				"sha256:d",
		},
	};
	const after: Resources = {
		...empty(),
		datasets: {
			crime: "sha256:a2",
			jobs: "sha256:b",
			unemployment: "sha256:e",
		},
		crosswalks: { "ward-to-lad": "sha256:c" },
		validationExceptions: {},
	};
	const release = (releaseId: string, resources?: Resources) => ({
		schemaVersion: 1 as const,
		releaseId,
		artifacts: [],
		...(resources ? { resources } : {}),
	});
	const comparison = compareAtlasReleases(
		release("sha256:before", before),
		release("sha256:after", after),
	);
	assert.deepEqual(comparison.resources.datasets, {
		status: "compared",
		added: ["unemployment"],
		removed: [],
		changed: ["crime"],
		unchanged: 1,
	});
	assert.deepEqual(comparison.resources.crosswalks, {
		status: "compared",
		added: [],
		removed: [],
		changed: [],
		unchanged: 1,
	});
	assert.deepEqual(comparison.resources.validationExceptions, {
		status: "compared",
		added: [],
		removed: ["exports/house-price-median-observations records-resolve"],
		changed: [],
		unchanged: 0,
	});
	assert.equal(
		compareAtlasReleases(
			release("sha256:old"),
			release("sha256:after", after),
		).resources.datasets.status,
		"not-recorded",
	);
});

test("names changed resource fields without claiming observation-record changes", () => {
	const before: AtlasRelease = {
		schemaVersion: 1,
		releaseId: "sha256:before",
		artifacts: [
			{
				id: "data-catalog",
				path: "data-catalog.json",
				contentHash: "sha256:a",
			},
		],
		resources: { datasets: { jobs: "sha256:one" } },
	};
	const after: AtlasRelease = {
		...before,
		releaseId: "sha256:after",
		artifacts: [
			{
				id: "data-catalog",
				path: "data-catalog.json",
				contentHash: "sha256:b",
			},
		],
		resources: { datasets: { jobs: "sha256:two" } },
	};
	const artifacts = new Map([
		[
			"sha256:before",
			JSON.stringify({
				datasets: [
					{
						id: "jobs",
						contentHash: "sha256:one",
						summary: { dataRecordCount: 10 },
					},
				],
			}),
		],
		[
			"sha256:after",
			JSON.stringify({
				datasets: [
					{
						id: "jobs",
						contentHash: "sha256:two",
						summary: { dataRecordCount: 12 },
					},
				],
			}),
		],
	]);
	const comparison = compareAtlasReleases(before, after);
	assert.deepEqual(
		semanticReleaseChanges(
			before,
			after,
			comparison.resources,
			(releaseId, artifactId) => {
				const body = artifacts.get(releaseId);
				return artifactId === "data-catalog" && body
					? { body: Buffer.from(body) }
					: undefined;
			},
		),
		{
			status: "available",
			changes: [
				{
					kind: "datasets",
					id: "jobs",
					fields: ["summary.dataRecordCount"],
				},
			],
		},
	);
});

test("says when a retained artifact cannot support a field-level comparison", () => {
	const release = (releaseId: string, contentHash: string): AtlasRelease => ({
		schemaVersion: 1,
		releaseId,
		artifacts: [],
		resources: { datasets: { jobs: contentHash } },
	});
	const before = release("sha256:before", "sha256:one");
	const after = release("sha256:after", "sha256:two");
	const comparison = compareAtlasReleases(before, after);
	assert.deepEqual(
		semanticReleaseChanges(
			before,
			after,
			comparison.resources,
			() => undefined,
		),
		{
			status: "unavailable",
			reason: "The retained data-catalog artifact is unavailable for one or both releases, so datasets cannot be compared by field.",
		},
	);
});
