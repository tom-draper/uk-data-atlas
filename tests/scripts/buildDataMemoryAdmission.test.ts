import assert from "node:assert/strict";
import { test } from "vitest";
import { buildDataStages } from "@/pipeline/build-data-graph.mjs";
import {
	blockersOf,
	conflicts,
	priorityOrder,
	NEEDS_FULL_RUN,
	runSchedule,
	stageMemoryMb,
} from "@/pipeline/build-data-scheduler.mjs";

type Stage = {
	name: string;
	dependencies: string[];
	args: string[];
	writes?: string[];
	cpuSlots?: number;
	trial?: { memoryMb: number };
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

type Run = {
	stages: Stage[];
	jobs?: number;
	memoryMb?: number;
	/** How long each stage really takes. */
	took: Record<string, number>;
	/** Stages whose command fails. */
	failing?: string[];
	/** Stages whose trial run finds work, so they run again in full. */
	rebuilding?: string[];
	order?: Stage[];
};

/**
 * Runs the real scheduler on a virtual clock: a stage takes exactly as long as
 * `took` says, and nothing sleeps. Every start is checked against the rules.
 */
async function replay({
	stages,
	jobs = 8,
	memoryMb = Infinity,
	took,
	failing = [],
	rebuilding = [],
	order = stages,
}: Run) {
	let now = 0;
	const blockers = blockersOf(stages);
	const running = new Map<string, { mb: number; slots: number }>();
	const started = new Map<string, number>();
	const ended = new Map<string, number>();
	const waits = new Map<string, { queuedMs: number; memoryWaitMs: number }>();
	const pending: Array<{
		end: number;
		order: number;
		name: string;
		done: (outcome: boolean | typeof NEEDS_FULL_RUN) => void;
		trial: boolean;
	}> = [];
	let serial = 0;
	let peakMb = 0;
	const byName = new Map(stages.map((entry) => [entry.name, entry]));
	const finished = new Set<string>();
	const done = runSchedule({
		stages,
		order,
		jobs,
		memoryMb,
		clock: () => now,
		settle: () => true,
		run: (
			entry: Stage,
			waited: { queuedMs: number; memoryWaitMs: number },
			{ trial }: { trial: boolean },
		) =>
			new Promise<boolean | typeof NEEDS_FULL_RUN>((resolve) => {
				const { name } = entry;
				waits.set(name, waited);
				for (const before of blockers.get(name)!)
					assert.ok(
						finished.has(before),
						`${name} started before ${before}`,
					);
				for (const other of running.keys())
					assert.ok(
						!conflicts(entry, byName.get(other)),
						`${name} started beside ${other}, which it conflicts with`,
					);
				running.set(
					name,
					trial
						? { mb: entry.trial!.memoryMb, slots: 1 }
						: {
								mb: stageMemoryMb(entry),
								slots: entry.cpuSlots ?? 1,
							},
				);
				assert.ok(
					[...running.values()].reduce(
						(slots, entry) => slots + entry.slots,
						0,
					) <= jobs,
					`${name} exceeded the job limit`,
				);
				const used = [...running.values()].reduce(
					(sum, entry) => sum + entry.mb,
					0,
				);
				if (running.size > 1)
					assert.ok(
						used <= memoryMb,
						`${name} exceeded the memory budget`,
					);
				peakMb = Math.max(peakMb, used);
				started.set(name, now);
				pending.push({
					end: now + took[name],
					order: serial++,
					name,
					done: resolve,
					trial,
				});
			}),
	});
	let settled = false;
	const outcome = done.then(
		() => {
			settled = true;
		},
		(error: unknown) => {
			settled = true;
			throw error;
		},
	);
	const flush = () => new Promise((resolve) => setImmediate(resolve));
	await flush();
	while (!settled && pending.length > 0) {
		pending.sort((a, b) => a.end - b.end || a.order - b.order);
		const next = pending.shift()!;
		now = Math.max(now, next.end);
		running.delete(next.name);
		if (next.trial && rebuilding.includes(next.name)) {
			next.done(NEEDS_FULL_RUN);
			await flush();
			continue;
		}
		ended.set(next.name, now);
		finished.add(next.name);
		next.done(!failing.includes(next.name));
		await flush();
	}
	await outcome;
	return { started, ended, waits, peakMb, finished };
}

test("a smaller stage backfills without delaying the waiting stage even when it takes longer", async () => {
	const stages = [
		stage("running", 2000),
		stage("large", 3000),
		stage("small", 500),
	];
	const result = await replay({
		stages,
		memoryMb: 4000,
		jobs: 2,
		took: { running: 100, large: 100, small: 150 },
	});
	assert.equal(result.started.get("running"), 0);
	assert.equal(result.started.get("large"), 100);
	assert.equal(result.started.get("small"), 0);
	assert.equal(result.ended.get("small"), 150);
});

test("backfill reserves memory for the waiting stage and any earlier jobs that could still be running", async () => {
	const result = await replay({
		stages: [
			stage("ends-first", 2100),
			stage("still-running", 1400),
			stage("waiting", 2400),
			stage("too-large", 900),
			stage("fits", 500),
			stage("overcommits", 400),
		],
		memoryMb: 4500,
		took: {
			"ends-first": 100,
			"still-running": 200,
			waiting: 100,
			"too-large": 200,
			fits: 200,
			overcommits: 200,
		},
	});
	// Even "ends-first" might be left running when memory becomes available.
	// In this budget it fits exactly alongside "waiting", so there is no slack.
	assert.equal(result.started.get("waiting"), 100);
	for (const name of ["too-large", "fits", "overcommits"])
		assert.ok(result.started.get(name)! >= 100);
});

test("successive backfills share the reservation and cannot consume it twice", async () => {
	const result = await replay({
		stages: [
			stage("ends-first", 2200),
			stage("still-running", 1400),
			stage("waiting", 2400),
			stage("fits", 500),
			stage("overcommits", 400),
		],
		memoryMb: 4500,
		took: {
			"ends-first": 100,
			"still-running": 200,
			waiting: 100,
			fits: 200,
			overcommits: 200,
		},
	});
	assert.equal(result.started.get("fits"), 0);
	assert.equal(result.started.get("waiting"), 100);
	assert.ok(result.started.get("overcommits")! >= 100);
});

test("CPU backfill fits alongside the waiting worker pool when current work finishes", async () => {
	const stages = [
		{ ...stage("running", 2), cpuSlots: 2 },
		{ ...stage("pool", 2), cpuSlots: 2 },
		stage("backfill", 1),
	];
	const { started, waits } = await replay({
		stages,
		jobs: 3,
		memoryMb: 5,
		took: { running: 10, pool: 5, backfill: 30 },
	});
	assert.equal(started.get("backfill"), 0);
	assert.equal(started.get("pool"), 10);
	assert.deepEqual(waits.get("pool"), { queuedMs: 10, memoryWaitMs: 0 });
});

test("a stage larger than the whole budget still runs, alone, and cannot stall the rest", async () => {
	const stages = [
		stage("small-b", 1000),
		stage("huge", 9000),
		stage("small-a", 1000),
		stage("after", 1000, ["huge"]),
	];
	const took = { huge: 100, "small-a": 30, "small-b": 400, after: 10 };
	const result = await replay({ stages, memoryMb: 4000, took });
	assert.equal(result.finished.size, 4);
	// It starts only once nothing else runs, as it always has.
	const huge = result.started.get("huge")!;
	for (const other of ["small-a", "small-b"]) {
		const overlaps =
			result.started.get(other)! < result.ended.get("huge")! &&
			huge < result.ended.get(other)!;
		assert.ok(!overlaps, `${other} overlapped the oversized stage`);
	}
	// Nothing starts behind it while it waits for the running stage to finish.
	assert.ok(
		result.started.get("small-a")! >= result.ended.get("huge")!,
		"small-a started while huge waited",
	);
	const alone = await replay({
		stages: [stage("huge", 9000), stage("tiny", 100)],
		memoryMb: 50,
		took: { huge: 10, tiny: 10 },
	});
	assert.equal(alone.finished.size, 2);
});

test("a stage that waits for memory reports how long", async () => {
	const stages = [stage("running", 2000), stage("large", 3000)];
	const memory = await replay({
		stages,
		memoryMb: 4000,
		took: { running: 100, large: 100 },
	});
	// `large` waited 100 ms for memory with a job slot free.
	assert.deepEqual(memory.waits.get("large"), {
		queuedMs: 100,
		memoryWaitMs: 100,
	});
	assert.deepEqual(memory.waits.get("running"), {
		queuedMs: 0,
		memoryWaitMs: 0,
	});
});

const generator = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const randomRun = (seed: number): Run & { stages: Stage[] } => {
	const random = generator(seed);
	const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]!;
	const count = 4 + Math.floor(random() * 22);
	const stages: Stage[] = [];
	const took: Record<string, number> = {};
	for (let index = 0; index < count; index++) {
		const name = `s${index}`;
		const dependencies = stages
			.filter(() => random() < 0.2)
			.map((earlier) => earlier.name);
		// Some stages share a path, so they conflict; some own theirs.
		const writes = [
			random() < 0.25
				? `data/shared-${Math.floor(random() * 3)}`
				: `data/${name}`,
		];
		stages.push(
			stage(
				name,
				pick([512, 1024, 1024, 2048, 3072, 4096, 6000]),
				dependencies,
				writes,
			),
		);
		took[name] = 1 + Math.floor(random() * 200);
	}
	return {
		stages,
		took,
		jobs: pick([1, 2, 3, 5, 12]),
		memoryMb: pick([1500, 3000, 4096, 5836, 9000, Infinity]),
		order:
			random() < 0.5
				? stages
				: priorityOrder(stages, (entry: Stage) => took[entry.name]!),
	};
};

test("the budget, job limit, dependencies and conflicts hold on random stage graphs", async () => {
	for (let seed = 1; seed <= 300; seed++) {
		const run = randomRun(seed);
		try {
			const result = await replay(run);
			assert.equal(
				result.finished.size,
				run.stages.length,
				"every stage runs",
			);
		} catch (error) {
			throw new Error(`seed ${seed}: ${String(error)}`, { cause: error });
		}
	}
});

test("the same stages and recorded timings give the same schedule", async () => {
	for (let seed = 1; seed <= 60; seed++) {
		const first = await replay(randomRun(seed));
		const second = await replay(randomRun(seed));
		assert.deepEqual(
			[...first.started],
			[...second.started],
			`seed ${seed}`,
		);
		assert.deepEqual([...first.ended], [...second.ended], `seed ${seed}`);
	}
});

test("a failure stops the stage that waits for memory from starting", async () => {
	const stages = [
		stage("failing", 2000),
		stage("steady", 1000),
		stage("large", 3000),
	];
	const result = await replay({
		stages,
		memoryMb: 4000,
		took: { failing: 50, steady: 100, large: 100 },
		failing: ["failing"],
	});
	// `failing` fails at 50 ms, which would leave room for `large`. It does not
	// start, and `steady` finishes.
	assert.ok(!result.started.has("large"));
	assert.ok(result.ended.has("steady"));
});

test("a stage that throws stops the build once the running stages finish", async () => {
	let now = 0;
	const events: string[] = [];
	await assert.rejects(
		runSchedule({
			stages: [
				stage("broken", 1000),
				stage("steady", 1000),
				stage("never", 1000, ["broken"]),
			],
			jobs: 4,
			memoryMb: 4000,
			clock: () => now++,
			settle: () => true,
			run: async (entry: Stage) => {
				events.push(`start ${entry.name}`);
				if (entry.name === "broken") throw new Error("cannot start");
				await new Promise((resolve) => setTimeout(resolve, 20));
				events.push(`end ${entry.name}`);
				return true;
			},
		}),
		/cannot start/,
	);
	assert.deepEqual(events, ["start broken", "start steady", "end steady"]);
});

test("the real stage graph runs to the end at several budgets", async () => {
	const stages = buildDataStages.filter(
		(entry: Stage & { check?: boolean }) =>
			!entry.check && !entry.name.startsWith("verify-"),
	);
	const took = Object.fromEntries(
		stages.map((entry: Stage, index: number) => [
			entry.name,
			5 + (index % 7) * 11,
		]),
	);
	const trials = stages
		.filter((entry: Stage) => entry.trial)
		.map((entry: Stage) => entry.name);
	for (const memoryMb of [2800, 5836, 12288])
		for (const rebuilding of [[], trials]) {
			const result = await replay({
				stages,
				jobs: 12,
				memoryMb,
				took,
				rebuilding,
			});
			assert.equal(result.finished.size, stages.length);
		}
});
