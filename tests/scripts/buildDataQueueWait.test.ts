import assert from "node:assert/strict";
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
import { runBuild } from "@/pipeline/build-data.mjs";
import { buildDataStages } from "@/pipeline/build-data-graph.mjs";
import { runSchedule } from "@/pipeline/build-data-scheduler.mjs";

type Stage = {
	name: string;
	dependencies: string[];
	args: string[];
	writes?: string[];
};

const stage = (
	name: string,
	memoryMb: number,
	dependencies: string[] = [],
	writes = [`data/build/${name}`],
): Stage => ({
	name,
	dependencies,
	args: [`--max-old-space-size=${memoryMb}`, `${name}.ts`],
	writes,
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("the scheduler tells each stage how long it queued and how much of that was memory", async () => {
	let now = 0;
	const waits = new Map<string, { queuedMs: number; memoryWaitMs: number }>();
	const finish = new Map<string, (succeeded: boolean) => void>();
	const done = runSchedule({
		// `large` does not fit beside `running`.
		stages: [
			stage("running", 3200),
			stage("large", 3000),
			stage("small", 900),
		],
		jobs: 2,
		memoryMb: 4000,
		clock: () => now,
		settle: () => true,
		run: (
			entry: Stage,
			waited: { queuedMs: number; memoryWaitMs: number },
		) =>
			new Promise<boolean>((resolve) => {
				waits.set(entry.name, waited);
				finish.set(entry.name, resolve);
			}),
	});
	await flush();
	now = 100;
	finish.get("running")!(true);
	await flush();
	finish.get("large")!(true);
	finish.get("small")!(true);
	await done;
	assert.deepEqual(waits.get("running"), { queuedMs: 0, memoryWaitMs: 0 });
	assert.deepEqual(waits.get("large"), { queuedMs: 100, memoryWaitMs: 100 });
});

test("time spent with every job slot taken is not counted as a memory wait", async () => {
	let now = 0;
	const waits = new Map<string, { queuedMs: number; memoryWaitMs: number }>();
	const finish = new Map<string, (succeeded: boolean) => void>();
	const done = runSchedule({
		stages: [stage("a", 1000), stage("b", 1000), stage("c", 1000)],
		jobs: 2,
		memoryMb: 2500,
		clock: () => now,
		settle: () => true,
		run: (
			entry: Stage,
			waited: { queuedMs: number; memoryWaitMs: number },
		) =>
			new Promise<boolean>((resolve) => {
				waits.set(entry.name, waited);
				finish.set(entry.name, resolve);
			}),
	});
	await flush();
	now = 40;
	finish.get("a")!(true);
	await flush();
	finish.get("b")!(true);
	finish.get("c")!(true);
	await done;
	// `c` was only held back by the job limit, and it fits in memory.
	assert.equal(waits.get("c")!.memoryWaitMs, 0);
});

const createCache = (root: string) =>
	createStageCache({
		root,
		stateFile: join(root, ".cache/stages.json"),
		codeFiles: () => [],
		environment: {},
	});

test("timing records carry the queue wait, and readers that ignore it still work", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-queue-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const stages = [
		stage("first", 1000, [], ["data/build/first"]),
		stage("second", 1000, ["first"], ["data/build/second"]),
	];
	const run = (jobs: string) =>
		runBuild({
			stages,
			argv: ["--jobs", jobs],
			log: () => {},
			logError: () => {},
			env: {},
			limits: { jobs: 4, memoryMb: 4000 },
			createCache: () => createCache(root),
			execute: async (current: Stage) => {
				const path = join(root, "data/build", current.name, "out.json");
				mkdirSync(dirname(path), { recursive: true });
				writeFileSync(path, current.name);
				return 0;
			},
		});
	assert.equal(await run("4"), 0);
	const summary = JSON.parse(
		readFileSync(join(root, ".cache/last-build.json"), "utf8"),
	);
	for (const entry of summary.stages) {
		// The old fields are all still there.
		assert.equal(entry.status, "ran");
		assert.equal(typeof entry.totalMs, "number");
		assert.equal(typeof entry.commandMs, "number");
		assert.ok(entry.queueMs >= 0);
		assert.ok(
			entry.memoryWaitMs >= 0 && entry.memoryWaitMs <= entry.queueMs,
		);
		assert.ok(entry.totalMs >= entry.commandMs);
	}
	const state = JSON.parse(
		readFileSync(join(root, ".cache/stages.json"), "utf8"),
	);
	const timing = state.stages.first.timing;
	assert.equal(typeof timing.commandMs, "number");
	assert.equal(typeof timing.totalMs, "number");
	assert.equal(typeof timing.queueMs, "number");
	assert.equal(typeof timing.memoryWaitMs, "number");
	assert.equal(createCache(root).lastTiming("first").totalMs, timing.totalMs);
});

test("recording queue timings leaves every stage cache key alone", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-keys-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const only = stage("only", 1000, [], ["data/build/only"]);
	const execute = async () => {
		const path = join(root, "data/build/only/out.json");
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, "out");
		return 0;
	};
	const build = () =>
		runBuild({
			stages: [only],
			argv: [],
			log: () => {},
			logError: () => {},
			env: {},
			limits: { jobs: 4, memoryMb: 4000 },
			createCache: () => createCache(root),
			execute,
		});
	assert.equal(await build(), 0);
	const keyBefore = JSON.parse(
		readFileSync(join(root, ".cache/stages.json"), "utf8"),
	).stages.only.key;
	// With the timing fields removed, as an older build left it, the key and
	// the cached result are the same, and the next build skips the stage.
	const path = join(root, ".cache/stages.json");
	const state = JSON.parse(readFileSync(path, "utf8"));
	delete state.stages.only.timing.queueMs;
	delete state.stages.only.timing.memoryWaitMs;
	writeFileSync(path, JSON.stringify(state));
	let ran = false;
	assert.equal(
		await runBuild({
			stages: [only],
			argv: [],
			log: () => {},
			logError: () => {},
			env: {},
			limits: { jobs: 4, memoryMb: 4000 },
			createCache: () => createCache(root),
			execute: async () => {
				ran = true;
				return 0;
			},
		}),
		0,
	);
	assert.equal(ran, false);
	assert.equal(
		JSON.parse(readFileSync(path, "utf8")).stages.only.key,
		keyBefore,
	);
});

test("no stage depends on the scheduler files, so scheduling changes cannot change its key", () => {
	const scheduling = [
		"build-data-scheduler",
		"build-data-stage-run",
		"build-data-report",
	];
	for (const entry of buildDataStages as Array<
		Stage & { codeInputs?: string[] }
	>) {
		const declared = JSON.stringify([entry.args, entry.codeInputs ?? []]);
		for (const file of scheduling)
			assert.ok(!declared.includes(file), `${entry.name} reads ${file}`);
	}
});
