import assert from "node:assert/strict";
import { test } from "vitest";
import { buildDataStages } from "@/pipeline/build-data-graph.mjs";
import {
	BACKFILL_MARGIN,
	blockersOf,
	conflicts,
	expectedDurationMs,
	priorityOrder,
	runSchedule,
	stageMemoryMb,
} from "@/pipeline/build-data-scheduler.mjs";

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

type Run = {
	stages: Stage[];
	jobs?: number;
	memoryMb?: number;
	/** How long each stage really takes. */
	took: Record<string, number>;
	/** What the scheduler is told to expect; a stage left out is unknown. */
	expected?: Record<string, number | null | undefined>;
	/** Stages whose command fails. */
	failing?: string[];
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
	expected = took,
	failing = [],
	order = stages,
}: Run) {
	let now = 0;
	const blockers = blockersOf(stages);
	const running = new Map<string, number>();
	const started = new Map<string, number>();
	const ended = new Map<string, number>();
	const waits = new Map<string, { queuedMs: number; memoryWaitMs: number }>();
	const pending: Array<{
		end: number;
		order: number;
		name: string;
		done: (succeeded: boolean) => void;
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
		expectedMs: (entry: Stage) => expected[entry.name] ?? null,
		settle: () => true,
		run: (
			entry: Stage,
			waited: { queuedMs: number; memoryWaitMs: number },
		) =>
			new Promise<boolean>((resolve) => {
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
				running.set(name, stageMemoryMb(entry));
				assert.ok(
					running.size <= jobs,
					`${name} exceeded the job limit`,
				);
				const used = [...running.values()].reduce((a, b) => a + b, 0);
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
		ended.set(next.name, now);
		finished.add(next.name);
		next.done(!failing.includes(next.name));
		await flush();
	}
	await outcome;
	return { started, ended, waits, peakMb, finished };
}

test("a small stage starts while a large one waits, and the large one is not delayed", async () => {
	const stages = [
		stage("running", 2000),
		stage("large", 3000),
		stage("small", 1000),
	];
	const took = { running: 100, large: 100, small: 50 };
	const result = await replay({
		stages,
		memoryMb: 4000,
		order: [stages[0]!, stages[1]!, stages[2]!],
		took,
	});
	// The small stage fits beside the running one and is done before the large
	// stage can start, so the large stage starts the moment it could anyway.
	assert.equal(result.started.get("small"), 0);
	assert.equal(result.started.get("large"), 100);
	// Without backfilling the small stage would only start after the large one.
	const strict = await replay({
		stages,
		memoryMb: 4000,
		order: stages,
		took,
		expected: {},
	});
	assert.equal(strict.started.get("large"), 100);
	assert.ok(strict.started.get("small")! >= 100);
});

test("a stage that would still run when the waiting one could start stays back, unless there is room for both", async () => {
	const stages = [
		stage("running", 2000),
		stage("large", 3000),
		stage("long-small", 1500),
		stage("long-tiny", 1000),
	];
	const took = {
		running: 100,
		large: 100,
		"long-small": 500,
		"long-tiny": 500,
	};
	const result = await replay({ stages, memoryMb: 4000, took });
	// 1500 MB beside the large stage would not fit in 4000 MB, so it waits.
	assert.ok(result.started.get("long-small")! >= result.ended.get("large")!);
	assert.equal(result.started.get("large"), 100);
	// 1000 MB leaves room for the large stage even while it still runs.
	assert.equal(result.started.get("long-tiny"), 0);
});

test("a stage is backfilled only when its recorded time, with a margin, fits before the waiting one starts", async () => {
	const stages = [
		stage("running", 2000),
		stage("large", 3000),
		stage("tight", 1500),
	];
	const took = { running: 100, large: 100, tight: 90 };
	// 90 ms fits in the 100 ms gap, but not with the margin.
	assert.ok(90 * BACKFILL_MARGIN > 100);
	const margin = await replay({ stages, memoryMb: 4000, took });
	assert.ok(margin.started.get("tight")! >= 100);
	const fits = await replay({
		stages,
		memoryMb: 4000,
		took: { ...took, tight: 75 },
	});
	assert.equal(fits.started.get("tight"), 0);
	assert.equal(fits.started.get("large"), 100);
});

test("without recorded times nothing starts ahead of the waiting stage", async () => {
	const stages = [
		stage("running", 2000),
		stage("large", 3000),
		stage("small", 1500),
	];
	const took = { running: 100, large: 100, small: 10 };
	for (const expected of [
		{},
		// A running stage with no record means the wait cannot be predicted.
		{ large: 100, small: 10 },
		{ running: null, small: 10 },
		{ running: Number.NaN, small: 10 },
		{ running: -5, small: 10 },
	]) {
		const result = await replay({ stages, memoryMb: 4000, took, expected });
		assert.ok(
			result.started.get("small")! >= 100,
			JSON.stringify(expected),
		);
		assert.equal(result.started.get("large"), 100);
	}
});

test("corrupt or unusable timing records give no expected duration", () => {
	assert.equal(expectedDurationMs({ commandMs: 1200, totalMs: 1500 }), 1200);
	assert.equal(
		expectedDurationMs({ commandMs: 1200, totalMs: 9000, queueMs: 7000 }),
		2000,
	);
	// A queue longer than the total cannot be taken off it.
	assert.equal(
		expectedDurationMs({ commandMs: 1200, totalMs: 900, queueMs: 7000 }),
		1200,
	);
	for (const bad of [
		undefined,
		null,
		"fast",
		7,
		[],
		{},
		{ commandMs: "12" },
		{ commandMs: -1 },
		{ commandMs: Number.NaN },
		{ commandMs: Number.POSITIVE_INFINITY },
		{ commandMs: 1200, failed: true },
	])
		assert.equal(expectedDurationMs(bad), null, JSON.stringify(bad));
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
	// Stages that finish before it can start are free to go ahead of it.
	assert.equal(result.started.get("small-a"), 0);
	const alone = await replay({
		stages: [stage("huge", 9000), stage("tiny", 100)],
		memoryMb: 50,
		took: { huge: 10, tiny: 10 },
	});
	assert.equal(alone.finished.size, 2);
});

test("stages that wait for memory report it apart from the job limit", async () => {
	const stages = [
		stage("running", 2000),
		stage("large", 3000),
		stage("job-bound", 100),
	];
	const memory = await replay({
		stages,
		memoryMb: 4000,
		took: { running: 100, large: 100, "job-bound": 10 },
		expected: {},
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
	// A stage held back by a full job limit is not waiting for memory. Here
	// `large` waits 50 ms with the limit full, then 50 ms for memory.
	const limited = await replay({
		stages: [
			stage("running", 2000),
			stage("large", 3000),
			stage("small", 1000),
		],
		jobs: 2,
		memoryMb: 4000,
		took: { running: 100, large: 100, small: 50 },
	});
	assert.deepEqual(limited.waits.get("large"), {
		queuedMs: 100,
		memoryWaitMs: 50,
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
	const expected: Record<string, number | null> = {};
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
		const mood = random();
		// Exact, wrong either way, or unknown.
		expected[name] =
			mood < 0.5
				? took[name]
				: mood < 0.7
					? Math.floor(took[name] * (0.2 + random() * 3))
					: mood < 0.85
						? null
						: Number.NaN;
	}
	return {
		stages,
		took,
		expected,
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

test("when the recorded times are right, the stage that waits first never starts later because of backfilling", async () => {
	for (let seed = 1; seed <= 300; seed++) {
		const random = generator(seed * 7919);
		const count = 3 + Math.floor(random() * 9);
		const stages: Stage[] = [];
		const took: Record<string, number> = {};
		for (let index = 0; index < count; index++) {
			const name = `s${index}`;
			stages.push(
				stage(
					name,
					[500, 1000, 1500, 2048, 3072, 4096][
						Math.floor(random() * 6)
					]!,
				),
			);
			took[name] = 5 + Math.floor(random() * 200);
		}
		const memoryMb = 4000 + Math.floor(random() * 5000);
		const strict = await replay({ stages, memoryMb, took, expected: {} });
		const waiting = stages.find(
			(entry) => strict.waits.get(entry.name)!.memoryWaitMs > 0,
		);
		if (!waiting) continue;
		const backfilled = await replay({ stages, memoryMb, took });
		assert.ok(
			backfilled.started.get(waiting.name)! <=
				strict.started.get(waiting.name)!,
			`seed ${seed}: ${waiting.name}`,
		);
	}
});

test("a failure stops backfilled stages from starting too", async () => {
	const stages = [
		stage("running", 2000),
		stage("large", 3000),
		stage("small", 1000),
		stage("later", 500, ["small"]),
	];
	const result = await replay({
		stages,
		memoryMb: 4000,
		took: { running: 100, large: 100, small: 50, later: 10 },
		failing: ["small"],
	});
	// `small` fails at 50 ms. `running` finishes, but neither `large`, which
	// was waiting, nor `later` starts afterwards.
	assert.ok(result.started.has("small"));
	assert.ok(!result.started.has("large"));
	assert.ok(!result.started.has("later"));
	assert.ok(result.ended.has("running"));
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

test("the real stage graph runs to the end at several budgets, with and without recorded times", async () => {
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
	for (const memoryMb of [2800, 5836, 12288]) {
		const none = await replay({
			stages,
			jobs: 12,
			memoryMb,
			took,
			expected: {},
		});
		assert.equal(none.finished.size, stages.length);
		const known = await replay({ stages, jobs: 12, memoryMb, took });
		assert.equal(known.finished.size, stages.length);
	}
});
