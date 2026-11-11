import assert from "node:assert/strict";
import { test } from "vitest";
import { createBuildReport } from "../../build-data-report.mjs";
import { createDigestTracker } from "../../build-data-digests.mjs";
import { createRunState, createStageRunner } from "../../build-data-stage-run.mjs";

const stage = (name: string, extra = {}) => ({
	name,
	dependencies: [] as string[],
	args: [`${name}.ts`],
	...extra,
});

function setup({
	stages = [stage("a")],
	cache = null as any,
	current = new Set<string>(),
	reuse = false,
	execute = async () => 0 as number,
	toRun = new Set(stages.map(({ name }) => name)),
	...flags
}: {
	stages?: ReturnType<typeof stage>[];
	cache?: any;
	current?: Set<string>;
	reuse?: boolean;
	execute?: (...args: any[]) => Promise<number>;
	toRun?: Set<string>;
	plan?: boolean;
	adopt?: boolean;
	verbose?: boolean;
	verifyOutputs?: boolean;
} = {}) {
	const lines: string[] = [];
	const errors: string[] = [];
	const log = (line: string) => lines.push(line);
	const { plan = false, adopt = false, verbose = false } = flags;
	const report = createBuildReport({
		cache,
		log,
		plan,
		adopt,
		verbose,
		startedAt: performance.now(),
		buildStartedAt: "now",
	});
	const tracker = createDigestTracker({
		stages,
		selected: stages,
		cache,
		reuse,
		current,
	});
	const state = createRunState();
	const runner = createStageRunner({
		state,
		log,
		logError: (message: string) => errors.push(message),
		execute,
		cache,
		plan,
		adopt,
		verbose,
		verifyOutputs: flags.verifyOutputs ?? false,
		jobs: 1,
		toRun,
		current,
		...tracker,
		recordTiming: report.recordTiming,
		timings: report.timings,
	});
	return { ...runner, ...tracker, state, lines, errors, report };
}

test("weightOf is the last run's time for a stage that runs, else 0", () => {
	const cache = { lastTiming: () => ({ totalMs: 1234 }) };
	const { weightOf } = setup({
		stages: [stage("a"), stage("b")],
		cache,
		toRun: new Set(["a"]),
	});
	assert.equal(weightOf(stage("a")), 1234);
	assert.equal(weightOf(stage("b")), 0);
});

test("a planned stage that has to run is logged with its estimate", () => {
	const cache = {
		lastTiming: () => ({ totalMs: 2000 }),
		outputDigest: () => null,
	};
	const { settle, state, lines } = setup({ plan: true, cache });
	assert.equal(settle(stage("a")), false);
	assert.deepEqual(lines, [
		"a: would run (last run 2.0s)",
		"  Command: pnpm a.ts",
		"  Depends on: none",
	]);
	assert.equal(state.estimated, 2000);
	assert.equal(state.knownEstimates, 1);
});

test("an unchanged stage is skipped and keeps its digest", () => {
	const cache = {
		lastTiming: () => undefined,
		outputDigest: () => null,
		lookup: () => "digest-a",
	};
	const { settle, digests, lines, report } = setup({ cache, reuse: true });
	assert.equal(settle(stage("a")), false);
	assert.deepEqual(lines, ["a: unchanged, skipped"]);
	assert.equal(digests.get("a"), "digest-a");
	assert.equal(report.timings[0].skipped, true);
});

test("a current always-running stage is skipped without a command", () => {
	const live = stage("live", { cacheable: false });
	const { settle, lines } = setup({
		stages: [live],
		current: new Set(["live"]),
	});
	assert.equal(settle(live), false);
	assert.deepEqual(lines, ["live: up to date, skipped"]);
});

test("a stage with nothing to reuse has to run", () => {
	const { settle } = setup();
	assert.equal(settle(stage("a")), true);
});

test("adopting skips stages that are not cacheable", () => {
	const live = stage("live", { cacheable: false });
	const { settle, lines, report } = setup({ stages: [live], adopt: true });
	assert.equal(settle(live), false);
	assert.deepEqual(lines, ["live: not cacheable, skipped"]);
	assert.equal(report.timings.length, 1);
});

test("a stage that exits 0 is recorded and logged as done", async () => {
	const calls: unknown[] = [];
	const cache = {
		lastTiming: () => undefined,
		outputDigest: () => null,
		begin: (...args: unknown[]) => calls.push(["begin", ...args]),
		manifestPath: () => "manifest",
		record: () => "new-digest",
		recordTiming: (name: string, timing: any) =>
			calls.push(["timing", name, timing.failed]),
	};
	const { settle, run, digests, lines, state } = setup({ cache });
	settle(stage("a"));
	assert.equal(await run(stage("a")), true);
	assert.equal(lines[0], "a: running (1 of 1)");
	assert.match(lines[1], /^a: done in /);
	assert.equal(digests.get("a"), "new-digest");
	assert.equal(state.failureStatus, null);
	assert.deepEqual(calls, [
		["begin", stage("a"), { audit: false }],
		["timing", "a", false],
	]);
});

test("a stage that exits non-zero stops the build with its status", async () => {
	const timings: boolean[] = [];
	const cache = {
		lastTiming: () => undefined,
		outputDigest: () => null,
		begin: () => {},
		manifestPath: () => undefined,
		recordTiming: (_name: string, timing: any) =>
			timings.push(timing.failed),
	};
	const { settle, run, state, errors, report } = setup({
		cache,
		execute: async () => 7,
	});
	settle(stage("a"));
	assert.equal(await run(stage("a")), false);
	assert.equal(state.failureStatus, 7);
	assert.equal(state.failed, true);
	assert.match(
		errors[0],
		/^a failed with exit code 7 after .*\. Build stopped$/,
	);
	assert.equal(report.timings[0].failed, true);
	assert.deepEqual(timings, [true]);
});

test("a stage that cannot start records the failure and rethrows", async () => {
	const { settle, run, report, state } = setup({
		execute: async () => {
			throw new Error("spawn failed");
		},
	});
	settle(stage("a"));
	await assert.rejects(run(stage("a")), /spawn failed/);
	assert.equal(report.timings[0].failed, true);
	assert.equal(state.failureStatus, null);
});

test("verifying outputs collects undeclared writes and wrong hashes", async () => {
	const cache = {
		lastTiming: () => undefined,
		outputDigest: () => null,
		begin: () => {},
		manifestPath: () => undefined,
		undeclaredChanges: () => ["x.json"],
		record: () => "digest",
		manifestMismatches: () => ["y.json", "z.json"],
		recordTiming: () => {},
	};
	const { settle, run, state, lines } = setup({
		cache,
		verifyOutputs: true,
	});
	settle(stage("a"));
	assert.equal(await run(stage("a")), true);
	assert.deepEqual(state.undeclaredStages, ["a"]);
	assert.deepEqual(state.mismatchedStages, ["a"]);
	assert.ok(lines.includes("a: changed 1 file outside its declared writes"));
	assert.ok(lines.includes("  x.json"));
	assert.ok(lines.includes("a: recorded a hash that does not match 2 files"));
});
