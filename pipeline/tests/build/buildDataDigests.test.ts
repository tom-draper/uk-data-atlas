import assert from "node:assert/strict";
import { test } from "vitest";
import {
	ALWAYS_RUNS,
	createDigestTracker,
	findCurrentStages,
} from "../../build-data-digests.mjs";

const stage = (name: string, dependencies: string[] = [], extra = {}) => ({
	name,
	dependencies,
	...extra,
});

// A cache that has stamped every stage in `known`, by name.
const fakeCache = (known: Record<string, string>) => ({
	outputDigest: (name: string) => known[name] ?? null,
	lookup: (stage: { name: string }) => known[stage.name] ?? null,
});

test("findCurrentStages keeps only always-running stages that report done", async () => {
	const selected = [
		stage("done", [], { cacheable: false, isCurrent: () => true }),
		stage("later", [], { cacheable: false, isCurrent: async () => false }),
		stage("silent", [], { cacheable: false }),
		stage("cached", [], { isCurrent: () => true }),
	];
	assert.deepEqual([...(await findCurrentStages(selected))], ["done"]);
});

test("digests start with the always-running stages", () => {
	const stages = [stage("live", [], { cacheable: false }), stage("a")];
	const tracker = createDigestTracker({
		stages,
		selected: stages,
		cache: null,
		reuse: false,
		current: new Set(),
	});
	assert.deepEqual([...tracker.digests], [["live", ALWAYS_RUNS]]);
});

test("dependency digests come from this build first, then the cache", () => {
	const a = stage("a");
	const b = stage("b", ["a", "live", "missing"]);
	const stages = [stage("live", [], { cacheable: false }), a, b];
	const tracker = createDigestTracker({
		stages,
		selected: stages,
		cache: fakeCache({ a: "digest-a" }),
		reuse: true,
		current: new Set(),
	});
	assert.deepEqual(tracker.dependencyDigests(b), [
		"digest-a",
		ALWAYS_RUNS,
		null,
	]);
	tracker.digests.set("a", "fresh");
	assert.equal(tracker.dependencyDigests(b)[0], "fresh");
});

test("a stage whose dependency has no digest is not reusable", () => {
	const a = stage("a");
	const tracker = createDigestTracker({
		stages: [a],
		selected: [a],
		cache: fakeCache({ a: "digest-a" }),
		reuse: true,
		current: new Set(),
	});
	assert.equal(tracker.reusableDigest(a, ["x"]), "digest-a");
	assert.equal(tracker.reusableDigest(a, [null]), null);
	assert.equal(
		tracker.reusableDigest(stage("live", [], { cacheable: false }), []),
		null,
	);
});

test("reuse off means every selected stage runs", () => {
	const stages = [stage("a"), stage("b", ["a"])];
	const tracker = createDigestTracker({
		stages,
		selected: stages,
		cache: fakeCache({ a: "x", b: "y" }),
		reuse: false,
		current: new Set(),
	});
	assert.deepEqual([...tracker.stagesToRun()], ["a", "b"]);
});

test("a stage that must run makes its dependents run", () => {
	const stages = [stage("a"), stage("b", ["a"]), stage("c")];
	// b is stamped but a is not, so a runs and b can no longer be trusted.
	const tracker = createDigestTracker({
		stages,
		selected: stages,
		cache: fakeCache({ b: "y", c: "z" }),
		reuse: true,
		current: new Set(),
	});
	assert.deepEqual([...tracker.stagesToRun()], ["a", "b"]);
});

test("current stages are left out of the run and count as always running", () => {
	const live = stage("live", [], { cacheable: false });
	const b = stage("b", ["live"]);
	const stages = [live, b];
	const tracker = createDigestTracker({
		stages,
		selected: stages,
		cache: fakeCache({ b: "y" }),
		reuse: true,
		current: new Set(["live"]),
	});
	assert.deepEqual([...tracker.stagesToRun()], []);
	const notCurrent = createDigestTracker({
		stages,
		selected: stages,
		cache: fakeCache({ b: "y" }),
		reuse: true,
		current: new Set(),
	});
	assert.deepEqual([...notCurrent.stagesToRun()], ["live"]);
});
