import assert from "node:assert/strict";
import test from "node:test";
import { compareAtlasReleases } from "../src/atlasReleaseComparison";

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
	assert.match(comparison.note, /does not infer record-level changes/);
});
