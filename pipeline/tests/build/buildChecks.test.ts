import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "vitest";
import { resolveChecks, runBuild } from "../../build-data.mjs";
import { createStageCache } from "../../build-data-cache.mjs";
import { buildDataStages } from "../../build-data-graph.mjs";

test("local builds skip the checks unless something switches them on", () => {
	const off = { run: false, reason: undefined };
	assert.deepEqual(resolveChecks({ env: {} }), off);
	assert.deepEqual(resolveChecks({ env: { CI: "" } }), off);
	assert.deepEqual(resolveChecks({ env: { CI: "0" } }), off);
	assert.deepEqual(resolveChecks({ env: { CI: "false" } }), off);
	assert.deepEqual(resolveChecks({ env: { DATA_BUILD_VERIFY: "0" } }), off);
	assert.deepEqual(resolveChecks({ flag: true, env: {} }), {
		run: true,
		reason: "--verify",
	});
	assert.deepEqual(resolveChecks({ env: { CI: "true" } }), {
		run: true,
		reason: "CI",
	});
	assert.deepEqual(resolveChecks({ env: { DATA_BUILD_VERIFY: "1" } }), {
		run: true,
		reason: "DATA_BUILD_VERIFY=1",
	});
});

/** A producer and a check on its output, run by a cache over a scratch root. */
function build(context: TestContext) {
	const root = mkdtempSync(join(tmpdir(), "atlas-checks-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	mkdirSync(join(root, "data/build/.stamps"), { recursive: true });
	writeFileSync(join(root, "checker.mjs"), "one");
	writeFileSync(join(root, "producer.mjs"), "one");
	const stages = [
		{
			name: "producer",
			dependencies: [],
			args: ["producer.mjs"],
			writes: ["data/build/producer.txt"],
			rawInputs: [],
		},
		{
			name: "check",
			dependencies: ["producer"],
			args: ["checker.mjs"],
			check: true,
			writes: ["data/build/.stamps/check.json"],
			rawInputs: [],
		},
	];
	const state = { output: "first", fail: false, ran: [] as string[] };
	const execute = (stage: { name: string }) => {
		state.ran.push(stage.name);
		if (stage.name === "producer")
			writeFileSync(join(root, "data/build/producer.txt"), state.output);
		else {
			if (state.fail) return 1;
			writeFileSync(join(root, "data/build/.stamps/check.json"), "{}\n");
		}
		return 0;
	};
	return {
		root,
		state,
		/** Runs a build and returns the stages it executed and what it logged. */
		async run(argv: string[] = [], env: Record<string, string> = {}) {
			state.ran = [];
			const lines: string[] = [];
			const status = await runBuild({
				argv,
				stages,
				execute,
				env,
				log: (line: string) => lines.push(line),
				logError: (line: string) => lines.push(line),
				createCache: () =>
					createStageCache({
						root,
						environment: {},
						codeFiles: (stage: { name: string }) => [
							stage.name === "check"
								? "checker.mjs"
								: "producer.mjs",
						],
					}),
			});
			return { status, ran: state.ran, log: lines.join("\n") };
		},
	};
}

test("a default local build runs the producer alone and says which checks it left out", async (context) => {
	const { run } = build(context);
	const result = await run();
	assert.equal(result.status, 0);
	assert.deepEqual(result.ran, ["producer"]);
	assert.match(result.log, /Parity checks not run \(1\): check\./);
	assert.match(result.log, /pnpm data:verify/);
});

test("--verify, DATA_BUILD_VERIFY=1 and CI each run the checks", async (context) => {
	for (const [argv, env] of [
		[["--verify"], {}],
		[[], { DATA_BUILD_VERIFY: "1" }],
		[[], { CI: "true" }],
	] as const) {
		const { run } = build(context);
		const result = await run([...argv], { ...env });
		assert.deepEqual(result.ran, ["producer", "check"]);
		assert.match(result.log, /Parity checks on/);
	}
});

test("a check is cached on its inputs and code, so it reruns only when they change", async (context) => {
	const { run, state, root } = build(context);
	assert.deepEqual((await run(["--verify"])).ran, ["producer", "check"]);
	// Nothing changed: the producer and the check are both skipped.
	assert.deepEqual((await run(["--verify"])).ran, []);
	// The producer's code changes but it writes identical bytes: the check has
	// nothing new to see.
	writeFileSync(join(root, "producer.mjs"), "two");
	assert.deepEqual((await run(["--verify"])).ran, ["producer"]);
	// A changed output reruns the check.
	writeFileSync(join(root, "producer.mjs"), "three");
	state.output = "second";
	assert.deepEqual((await run(["--verify"])).ran, ["producer", "check"]);
	assert.deepEqual((await run(["--verify"])).ran, []);
	// So does a change to the check's own code.
	writeFileSync(join(root, "checker.mjs"), "two");
	assert.deepEqual((await run(["--verify"])).ran, ["check"]);
});

test("checks skipped locally run once the build turns them on, and only then", async (context) => {
	const { run, state } = build(context);
	assert.deepEqual((await run()).ran, ["producer"]);
	state.output = "second";
	assert.deepEqual((await run(["--from", "producer"])).ran, ["producer"]);
	// The output changed with no check; the next verified build runs it once.
	assert.deepEqual((await run(["--verify"])).ran, ["check"]);
	assert.deepEqual((await run(["--verify"])).ran, []);
});

test("a failing check fails the build, and is not remembered as passed", async (context) => {
	const { run, state } = build(context);
	state.fail = true;
	const failed = await run([], { CI: "true" });
	assert.equal(failed.status, 1);
	assert.deepEqual(failed.ran, ["producer", "check"]);
	assert.match(failed.log, /check failed with exit code 1/);
	// Mended, it runs again rather than being skipped as unchanged.
	state.fail = false;
	const mended = await run([], { CI: "true" });
	assert.equal(mended.status, 0);
	assert.deepEqual(mended.ran, ["check"]);
});

test("--checks runs the check stages alone against the outputs already built", async (context) => {
	const { run, state } = build(context);
	await run();
	state.output = "stale, never rebuilt";
	const result = await run(["--checks"]);
	assert.equal(result.status, 0);
	assert.deepEqual(result.ran, ["check"]);
	assert.match(result.log, /Parity checks on \(--checks\)/);
	// The same check is skipped while the outputs it read are unchanged.
	assert.deepEqual((await run(["--checks"])).ran, []);
	// --no-cache runs it again.
	assert.deepEqual((await run(["--checks", "--no-cache"])).ran, ["check"]);
});

test("--only names a check to run it whatever the mode", async (context) => {
	const { run } = build(context);
	const result = await run(["--only", "check"]);
	assert.deepEqual(result.ran, ["producer", "check"]);
	assert.doesNotMatch(result.log, /Parity checks not run/);
});

test("--checks cannot be combined with options that pick other stages", async (context) => {
	const { run } = build(context);
	await assert.rejects(run(["--checks", "--only", "check"]), /--checks/);
	await assert.rejects(run(["--checks", "--from", "producer"]), /--checks/);
	await assert.rejects(run(["--checks", "--adopt"]), /--checks/);
	await assert.rejects(run(["--checks", "--verify"]), /drop --verify/);
	await assert.rejects(run(["--verify", "--verify"]), /Unknown or repeated/);
});

test("every check stage in the real graph depends on what it reads and nothing depends on it", () => {
	const checks = buildDataStages.filter((stage) => stage.check);
	assert.ok(checks.length > 0);
	const names = new Set(checks.map((stage) => stage.name));
	for (const check of checks) {
		assert.ok(check.dependencies.length > 0, check.name);
		assert.equal(check.cacheable, true, check.name);
		assert.ok(check.requiredOutputs.length > 0, check.name);
		for (const dependency of check.dependencies)
			assert.ok(!names.has(dependency), `${check.name} <- ${dependency}`);
	}
	for (const stage of buildDataStages)
		for (const dependency of stage.dependencies)
			assert.ok(!names.has(dependency), `${stage.name} <- ${dependency}`);
});
