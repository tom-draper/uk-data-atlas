import assert from "node:assert/strict";
import test from "node:test";
import {
	type AtlasReleaseManifest,
	compareReleases,
	syncPlan,
} from "../examples/releaseChanges";

const previous: AtlasReleaseManifest = {
	releaseId: "sha256:previous",
	resources: {
		exports: { kept: "sha256:a", revised: "sha256:b", retired: "sha256:c" },
		lookups: { areas: "sha256:d" },
		crosswalks: { dropped: "sha256:e" },
	},
};

const current: AtlasReleaseManifest = {
	releaseId: "sha256:current",
	resources: {
		exports: { kept: "sha256:a", revised: "sha256:B", fresh: "sha256:f" },
		lookups: { areas: "sha256:d" },
		terrainLayers: { surface: "sha256:g" },
	},
};

test("compares resource fingerprints kind by kind", () => {
	const changes = compareReleases(previous, current);
	assert.deepEqual(changes.exports, {
		status: "compared",
		added: ["fresh"],
		removed: ["retired"],
		changed: ["revised"],
		unchanged: 1,
	});
	assert.deepEqual(changes.lookups, {
		status: "compared",
		added: [],
		removed: [],
		changed: [],
		unchanged: 1,
	});
	// A kind only one manifest records is not taken as wholly added or removed.
	assert.deepEqual(changes.crosswalks, {
		status: "not-recorded",
		reason: "sha256:current does not record crosswalks.",
	});
	assert.deepEqual(changes.terrainLayers, {
		status: "not-recorded",
		reason: "sha256:previous does not record terrainLayers.",
	});
});

test("fetches only added and changed resources, and drops removed ones", () => {
	const changes = compareReleases(previous, current);
	assert.deepEqual(syncPlan(changes, current, "exports"), {
		fetch: ["fresh", "revised"],
		drop: ["retired"],
	});
	assert.deepEqual(syncPlan(changes, current, "lookups"), {
		fetch: [],
		drop: [],
	});
	// Nothing shows which uncompared resources are current, so take them all.
	assert.deepEqual(syncPlan(changes, current, "terrainLayers"), {
		fetch: ["surface"],
		drop: [],
	});
});

test("takes everything on a first sync", () => {
	const changes = compareReleases(undefined, current);
	assert.deepEqual(syncPlan(changes, current, "exports"), {
		fetch: ["fresh", "kept", "revised"],
		drop: [],
	});
	assert.equal(changes.lookups?.status, "compared");
});

test("finds nothing to fetch against an unchanged release", () => {
	const changes = compareReleases(current, current);
	for (const kind of Object.keys(current.resources!))
		assert.deepEqual(syncPlan(changes, current, kind), {
			fetch: [],
			drop: [],
		});
});
