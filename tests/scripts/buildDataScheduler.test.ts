import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished, test } from "vitest";
import { createStageCache } from "@/pipeline/build-data-cache.mjs";
import { planBuild, runBuild } from "@/pipeline/build-data.mjs";
import { buildDataStages } from "@/pipeline/build-data-graph.mjs";
import {
	blockersOf,
	conflicts,
	planWaves,
	priorityOrder,
	resolveLimits,
	runSchedule,
	stageMemoryMb,
} from "@/pipeline/build-data-scheduler.mjs";

type Stage = {
	name: string;
	dependencies: string[];
	args: string[];
	cacheable?: boolean;
	isCurrent?: () => boolean | Promise<boolean>;
	writes?: string[];
	outputs?: string[];
};

const stage = (
	name: string,
	dependencies: string[] = [],
	extra: Partial<Stage> = {},
): Stage => ({
	name,
	dependencies,
	args: [name],
	writes: [`data/build/${name}`],
	...extra,
});

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Fake stage commands that record when they start and finish. */
function recorder(durations: Record<string, number> = {}, failing = "") {
	const events: string[] = [];
	let active = 0;
	let peak = 0;
	const execute = async (current: Stage) => {
		events.push(`start ${current.name}`);
		active += 1;
		peak = Math.max(peak, active);
		await sleep(durations[current.name] ?? 15);
		active -= 1;
		events.push(`end ${current.name}`);
		return current.name === failing ? 3 : 0;
	};
	return { events, execute, peak: () => peak };
}

const build = async (
	stages: Stage[],
	options: {
		argv?: string[];
		limits?: { jobs: number; memoryMb: number };
		execute: (stage: Stage) => Promise<number> | number;
		createCache?: () => ReturnType<typeof createStageCache>;
	},
) => {
	const log: string[] = [];
	const errors: string[] = [];
	const status = await runBuild({
		stages,
		log: (line: string) => log.push(line),
		logError: (message: string) => errors.push(message),
		...options,
	});
	return { status, log, errors };
};

const unlimited = { jobs: 8, memoryMb: Infinity };

test("a stage starts only after its dependencies have finished", async () => {
	const stages = [
		stage("root"),
		stage("left", ["root"]),
		stage("right", ["root"]),
		stage("join", ["left", "right"]),
	];
	const { events, execute } = recorder({ left: 30, right: 10 });
	const { status } = await build(stages, { execute, limits: unlimited });
	assert.equal(status, 0);
	assert.deepEqual(events.slice(0, 2), ["start root", "end root"]);
	assert.ok(events.indexOf("start left") < events.indexOf("end right"));
	assert.ok(events.indexOf("start join") > events.indexOf("end left"));
	assert.ok(events.indexOf("start join") > events.indexOf("end right"));
});

test("no more stages run at once than --jobs allows", async () => {
	const stages = Array.from({ length: 6 }, (_, index) => stage(`s${index}`));
	const wide = recorder();
	await build(stages, { execute: wide.execute, limits: unlimited });
	assert.equal(wide.peak(), 6);
	const capped = recorder();
	await build(stages, {
		argv: ["--jobs", "2"],
		execute: capped.execute,
		limits: unlimited,
	});
	assert.equal(capped.peak(), 2);
});

test("stages are held back when their heap limits exceed the memory budget", async () => {
	const heavy = (name: string) =>
		stage(name, [], { args: ["--max-old-space-size=3072", name] });
	const stages = [heavy("a"), heavy("b"), heavy("c"), heavy("d")];
	const run = recorder();
	await build(stages, {
		execute: run.execute,
		limits: { jobs: 8, memoryMb: 7000 },
	});
	assert.equal(run.peak(), 2);
	// A stage larger than the whole budget still runs, alone.
	const alone = recorder();
	await build(stages, {
		execute: alone.execute,
		limits: { jobs: 8, memoryMb: 1000 },
	});
	assert.equal(alone.peak(), 1);
	assert.equal(stageMemoryMb(stages[0]), 3072);
	assert.equal(stageMemoryMb(stage("plain")), 1024);
});

test("stages that share a path, or declare none, never overlap and keep plan order", async () => {
	const stages = [
		stage("first", [], { writes: ["data/build/shared.sqlite"] }),
		stage("free-one"),
		stage("second", [], { writes: ["data/build/shared.sqlite"] }),
		stage("free-two"),
		stage("unknown", [], { writes: [] }),
		stage("after"),
	];
	const { events, execute } = recorder({ first: 40, second: 10 });
	await build(stages, { execute, limits: unlimited });
	// The shared writers run one after the other, in plan order.
	assert.ok(events.indexOf("end first") < events.indexOf("start second"));
	// The free stages overlap them.
	assert.ok(events.indexOf("start free-one") < events.indexOf("end first"));
	// A stage with no declared paths waits for everything before it and holds
	// back everything after it.
	const start = events.indexOf("start unknown");
	for (const name of ["first", "free-one", "second", "free-two"])
		assert.ok(events.indexOf(`end ${name}`) < start, name);
	assert.ok(events.indexOf("end unknown") < events.indexOf("start after"));
	assert.ok(
		conflicts(
			stage("a", [], { writes: ["x/y"] }),
			stage("b", [], { writes: ["x"] }),
		),
	);
	assert.ok(
		!conflicts(
			stage("a", [], { writes: ["x/y"] }),
			stage("b", [], { writes: ["x/z"] }),
		),
	);
});

test("a failure starts no new stage, lets running ones finish and records them", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-failure-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), "output");
	};
	const stages = [
		stage("bad"),
		stage("slow"),
		stage("later", ["bad"]),
		stage("unrelated", ["slow"]),
	];
	const cache = () =>
		createStageCache({
			root,
			stateFile: join(root, ".cache/stages.json"),
			codeFiles: () => [],
			environment: {},
		});
	const events: string[] = [];
	const result = await build(stages, {
		limits: unlimited,
		execute: async (current) => {
			events.push(`start ${current.name}`);
			await sleep(current.name === "bad" ? 10 : 60);
			write(`data/build/${current.name}/out.json`);
			events.push(`end ${current.name}`);
			return current.name === "bad" ? 4 : 0;
		},
		createCache: cache,
	});
	assert.equal(result.status, 4);
	assert.deepEqual(result.errors, [
		"bad failed with exit code 4 after " +
			result.errors[0]!.match(/after (\S+)\./)![1] +
			". Build stopped",
	]);
	// slow was running, so it finished; nothing started after the failure.
	assert.deepEqual(events, [
		"start bad",
		"start slow",
		"end bad",
		"end slow",
	]);
	assert.ok(
		result.log.some((line) =>
			/^Data build failed after \S+ \(1 ran, 1 failed, 0 unchanged\)$/.test(
				line,
			),
		),
		result.log.join("\n"),
	);
	// The finished stage is cached, the failed one is not.
	const next = cache();
	assert.notEqual(next.lookup(stages[1], []), null);
	assert.equal(next.lookup(stages[0], []), null);
});

test("a stage that throws is reported once the running stages finish", async () => {
	const events: string[] = [];
	await assert.rejects(
		build([stage("broken"), stage("steady"), stage("never", ["broken"])], {
			limits: unlimited,
			execute: async (current) => {
				events.push(`start ${current.name}`);
				if (current.name === "broken") throw new Error("cannot start");
				await sleep(30);
				events.push(`end ${current.name}`);
				return 0;
			},
		}),
		/cannot start/,
	);
	assert.deepEqual(events, ["start broken", "start steady", "end steady"]);
});

test("--jobs 1 runs the real graph in plan order and logs exactly as a default build", async () => {
	const planned = planBuild(buildDataStages, undefined, undefined).map(
		({ name }: Stage) => name,
	);
	const current = new Set(
		await Promise.all(
			(buildDataStages as Stage[])
				.filter((stage) => stage.cacheable === false)
				.map(async (stage) =>
					(await stage.isCurrent?.()) ? stage.name : undefined,
				),
		).then((names) =>
			names.filter((name): name is string => name !== undefined),
		),
	);
	const run = async (argv: string[]) => {
		const ran: string[] = [];
		const result = await build(buildDataStages as Stage[], {
			argv,
			execute: (current) => {
				ran.push(current.name);
				return 0;
			},
		});
		return { ran, log: result.log };
	};
	const single = await run(["--jobs", "1"]);
	assert.deepEqual(
		single.ran,
		planned.filter((name) => !current.has(name)),
	);
	const defaults = await run([]);
	assert.deepEqual(
		defaults.ran,
		planned.filter((name) => !current.has(name)),
	);
	// Timings differ between runs, so compare the lines before the ranking.
	const head = (lines: string[]) =>
		lines.slice(0, lines.indexOf("Slowest stages:"));
	assert.deepEqual(head(single.log), head(defaults.log));
	// One at a time also means no stage name prefix in the output.
	assert.ok(!single.log.some((line) => line.startsWith("Running up to")));
});

test("running stages together leaves the same outputs, digests and skips as one at a time", async () => {
	const stages = [
		stage("download", [], { cacheable: false, writes: ["data/build/raw"] }),
		stage("left", ["download"]),
		stage("right", ["download"]),
		stage("cache-a", ["left"], { writes: ["data/build/cache.sqlite"] }),
		stage("cache-b", ["right"], { writes: ["data/build/cache.sqlite"] }),
		stage("join", ["cache-a", "cache-b"]),
	];
	const attempt = async (jobs: string) => {
		const root = mkdtempSync(join(tmpdir(), "atlas-build-parity-"));
		onTestFinished(() => rmSync(root, { recursive: true, force: true }));
		mkdirSync(join(root, "data/source"), { recursive: true });
		writeFileSync(join(root, "data/source/input.csv"), "a\n");
		const execute = async (current: Stage) => {
			await sleep(current.name === "left" ? 30 : 5);
			const files =
				current.name === "cache-a" || current.name === "cache-b"
					? ["data/build/cache.sqlite"]
					: [`data/build/${current.name}/out.json`];
			for (const file of files) {
				mkdirSync(dirname(join(root, file)), { recursive: true });
				writeFileSync(
					join(root, file),
					`${current.name}\n${current.name.startsWith("cache") ? "x" : ""}`,
				);
			}
			ran.push(current.name);
			return 0;
		};
		const ran: string[] = [];
		const createCache = () =>
			createStageCache({
				root,
				stateFile: join(root, ".cache/stages.json"),
				codeFiles: () => [],
				environment: {},
			});
		const first = await build(stages, {
			argv: ["--jobs", jobs],
			execute,
			limits: unlimited,
			createCache,
		});
		assert.equal(first.status, 0);
		const firstRan = [...ran];
		ran.length = 0;
		await build(stages, {
			argv: ["--jobs", jobs],
			execute,
			limits: unlimited,
			createCache,
		});
		const state = JSON.parse(
			readFileSync(join(root, ".cache/stages.json"), "utf8"),
		);
		const summary = Object.fromEntries(
			Object.entries(state.stages).map(
				([name, record]: [string, any]) => [
					name,
					{
						digest: record.digest,
						outputs: Object.keys(record.outputs),
					},
				],
			),
		);
		return { firstRan: firstRan.sort(), secondRan: [...ran], summary };
	};
	const sequential = await attempt("1");
	const parallel = await attempt("4");
	assert.deepEqual(parallel.firstRan, sequential.firstRan);
	assert.deepEqual(parallel.secondRan, sequential.secondRan);
	assert.deepEqual(parallel.secondRan, ["download"]);
	assert.deepEqual(parallel.summary, sequential.summary);
});

test("jobs and the memory budget come from the machine unless overridden", () => {
	const machine = {
		cpus: 8,
		totalMemory: 16 * 1024 ** 3,
		freeMemory: 6 * 1024 ** 3,
	};
	assert.deepEqual(resolveLimits({ env: {}, ...machine }), {
		jobs: 8,
		memoryMb: 6144,
	});
	// Free memory above three quarters of the total is capped.
	assert.equal(
		resolveLimits({ env: {}, ...machine, freeMemory: 15 * 1024 ** 3 })
			.memoryMb,
		12288,
	);
	assert.deepEqual(
		resolveLimits({
			env: { DATA_BUILD_JOBS: "3", DATA_BUILD_MEMORY_MB: "5000" },
			...machine,
		}),
		{ jobs: 3, memoryMb: 5000 },
	);
	assert.throws(
		() => resolveLimits({ env: { DATA_BUILD_JOBS: "0" }, ...machine }),
		/DATA_BUILD_JOBS must be a positive whole number/,
	);
});

test("--jobs needs a positive whole number", async () => {
	for (const argv of [["--jobs"], ["--jobs", "0"], ["--jobs", "two"]])
		await assert.rejects(
			build([stage("only")], { argv, execute: () => 0 }),
			/--jobs requires a positive whole number/,
		);
	await assert.rejects(
		build([stage("only")], {
			argv: ["--jobs", "2", "--jobs", "3"],
			execute: () => 0,
		}),
		/Unknown or repeated argument: --jobs/,
	);
});

test("the longest chain starts first and the plan reports waves and a critical path", () => {
	const stages = [
		stage("quick"),
		stage("long-a"),
		stage("long-b", ["long-a"]),
		stage("long-c", ["long-b"]),
	];
	const weight = (current: Stage) => (current.name === "quick" ? 1 : 100);
	assert.deepEqual(
		priorityOrder(stages, weight).map(({ name }: Stage) => name),
		["long-a", "long-b", "long-c", "quick"],
	);
	const runs = new Set(stages.map(({ name }) => name));
	const plan = planWaves(stages, { runs, weightOf: weight });
	assert.deepEqual(plan.waves, [["quick", "long-a"], ["long-b"], ["long-c"]]);
	assert.deepEqual(plan.criticalPath, ["long-a", "long-b", "long-c"]);
	assert.equal(plan.criticalMs, 300);
	assert.equal(plan.totalMs, 301);
	// A stage that would be skipped adds no wave and no time.
	const skipped = planWaves(stages, {
		runs: new Set(["quick", "long-b", "long-c"]),
		weightOf: weight,
	});
	assert.deepEqual(skipped.waves, [["quick", "long-b"], ["long-c"]]);
	assert.deepEqual([...blockersOf(stages).get("long-b")!], ["long-a"]);
});

test("a scheduler with nothing runnable and stages left reports them", async () => {
	await assert.rejects(
		runSchedule({
			stages: [stage("a", ["b"]), stage("b", ["a"])],
			settle: () => true,
			run: async () => true,
		}),
		/Cannot schedule: a, b/,
	);
});

test("stages that run together print their name in front of each output line", () => {
	const directory = mkdtempSync(join(tmpdir(), "atlas-build-prefix-"));
	onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
	const script = join(directory, "runner.mjs");
	const runner = join(process.cwd(), "pipeline/build-data.mjs");
	const stageScript = (name: string) =>
		`setTimeout(() => console.log("hello from ${name}"), 20)`;
	writeFileSync(
		script,
		`import { runBuild } from ${JSON.stringify(`file://${runner}`)};
const stages = ["one", "two"].map((name) => ({
  name, dependencies: [], args: ["-e", ${JSON.stringify(stageScript("X"))}.replace("X", name)],
  writes: ["data/build/" + name],
}));
process.exitCode = await runBuild({
  argv: process.argv.slice(2), stages, limits: { jobs: 2, memoryMb: 4096 },
});
`,
	);
	const together = spawnSync(process.execPath, [script, "--no-cache"], {
		encoding: "utf8",
	});
	assert.equal(together.status, 0, together.stderr);
	assert.match(together.stdout, /^ {2}\[one\] hello from one$/m);
	assert.match(together.stdout, /^ {2}\[two\] hello from two$/m);
	const alone = spawnSync(
		process.execPath,
		[script, "--no-cache", "--jobs", "1"],
		{ encoding: "utf8" },
	);
	assert.match(alone.stdout, /^ {2}hello from one$/m);
});

test("conflict ordering uses the plan, so skipped stages need no special case", async () => {
	const stages = [
		stage("early", [], { writes: ["data/build/db"] }),
		stage("late", [], { writes: ["data/build/db"] }),
	];
	const settled: string[] = [];
	const order: string[] = [];
	await runSchedule({
		stages,
		jobs: 4,
		settle: (current: Stage) => {
			settled.push(current.name);
			return current.name === "late";
		},
		run: async (current: Stage) => {
			order.push(current.name);
			return true;
		},
	});
	assert.deepEqual(settled, ["early", "late"]);
	assert.deepEqual(order, ["late"]);
});

test("a plan lists the waves of stages that can run together and the critical path", async () => {
	const stages = [
		stage("root"),
		stage("left", ["root"]),
		stage("right", ["root"]),
		stage("deep", ["left"]),
		stage("join", ["deep", "right"]),
	];
	const executed: string[] = [];
	const { status, log } = await build(stages, {
		argv: ["--plan"],
		limits: { jobs: 4, memoryMb: 8192 },
		execute: (current) => {
			executed.push(current.name);
			return 0;
		},
	});
	assert.equal(status, 0);
	assert.deepEqual(executed, []);
	const start = log.findIndex((line) => line.startsWith("Parallel schedule"));
	assert.match(log[start]!, /up to 4 at once within 8,192 MB/);
	assert.deepEqual(log.slice(start + 1), [
		"  1. root",
		"  2. left, right",
		"  3. deep",
		"  4. join",
		"Critical path: root > left > deep > join",
	]);
});

test("the real graph runs with overlap but never breaks a dependency or a shared path", async () => {
	const stages = buildDataStages as Stage[];
	const current = new Set(
		await Promise.all(
			stages
				.filter((stage) => stage.cacheable === false)
				.map(async (stage) =>
					(await stage.isCurrent?.()) ? stage.name : undefined,
				),
		).then((names) =>
			names.filter((name): name is string => name !== undefined),
		),
	);
	const executedStages = stages.filter((stage) => !current.has(stage.name));
	const started = new Map<string, number>();
	const ended = new Map<string, number>();
	let tick = 0;
	let peak = 0;
	let active = 0;
	const { status } = await build(stages, {
		limits: { jobs: 8, memoryMb: Infinity },
		execute: async (current) => {
			started.set(current.name, (tick += 1));
			active += 1;
			peak = Math.max(peak, active);
			await sleep(2);
			active -= 1;
			ended.set(current.name, (tick += 1));
			return 0;
		},
	});
	assert.equal(status, 0);
	assert.ok(peak > 1, "some stages overlap");
	assert.equal(ended.size, executedStages.length);
	for (const stage of executedStages)
		for (const dependency of stage.dependencies)
			if (!current.has(dependency))
				assert.ok(
					ended.get(dependency)! < started.get(stage.name)!,
					`${stage.name} started before ${dependency} finished`,
				);
	for (const [index, first] of executedStages.entries())
		for (const second of executedStages.slice(index + 1))
			if (conflicts(first, second))
				assert.ok(
					ended.get(first.name)! < started.get(second.name)!,
					`${first.name} and ${second.name} overlapped`,
				);
});

test("--verify-outputs fails and names the stages that change files outside their declared writes", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-audit-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), path);
	};
	const stages = [stage("tidy"), stage("stray", ["tidy"])];
	const { status, log } = await build(stages, {
		argv: ["--verify-outputs"],
		limits: unlimited,
		execute: (current) => {
			write(`data/build/${current.name}/out.json`);
			if (current.name === "stray") write("data/build/other.json");
			return 0;
		},
		createCache: () =>
			createStageCache({
				root,
				stateFile: join(root, ".cache/stages.json"),
				codeFiles: () => [],
				environment: {},
			}),
	});
	assert.equal(status, 1);
	assert.ok(
		log.includes("stray: changed 1 file outside its declared writes"),
	);
	assert.ok(log.includes("  data/build/other.json"));
	assert.ok(!log.some((line) => line.startsWith("tidy: changed")));
	assert.ok(
		log.some((line) =>
			line.startsWith("Undeclared writes in 1 stage: stray."),
		),
	);
	await assert.rejects(
		build(stages, {
			argv: ["--verify-outputs", "--jobs", "2"],
			execute: () => 0,
		}),
		/cannot be combined/,
	);
});
