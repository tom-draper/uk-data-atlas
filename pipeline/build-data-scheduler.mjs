import { availableParallelism, totalmem } from "node:os";
import { stageScope } from "./build-data-cache.mjs";

/** What a stage costs when its command sets no `--max-old-space-size`. */
export const DEFAULT_STAGE_MEMORY_MB = 1024;
/** Plan weight of a stage that has no recorded timing. */
export const DEFAULT_STAGE_WEIGHT_MS = 1000;
const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;
const COMPACT_BUILD_MEMORY_MB = 5 * 1024;

const positiveInteger = (value, label) => {
	if (!/^[1-9]\d*$/.test(String(value)))
		throw new Error(`${label} must be a positive whole number.`);
	return Number(value);
};

/**
 * How many stages may run at once, and the memory they may use together.
 * Jobs default to the CPU count. Use currently available memory (including
 * reclaimable memory where the OS reports it), less 1 GiB of headroom.
 * Reserve at least 3 GiB or a quarter of installed RAM for the rest of the
 * system. Override these defaults with
 * DATA_BUILD_JOBS and DATA_BUILD_MEMORY_MB.
 *
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   cpus?: number,
 *   totalMemory?: number,
 *   availableMemory?: number,
 * }} [options]
 */
export function resolveLimits({
	env = process.env,
	cpus = availableParallelism(),
	totalMemory = totalmem(),
	availableMemory = process.availableMemory(),
} = {}) {
	const jobs =
		env.DATA_BUILD_JOBS === undefined
			? Math.max(1, cpus)
			: positiveInteger(env.DATA_BUILD_JOBS, "DATA_BUILD_JOBS");
	const memoryMb =
		env.DATA_BUILD_MEMORY_MB === undefined
			? Math.max(
					1,
					Math.floor(
						Math.min(
							availableMemory - GIBIBYTE,
							totalMemory - 3 * GIBIBYTE,
							totalMemory * 0.75,
						) / MEBIBYTE,
					),
				)
			: positiveInteger(env.DATA_BUILD_MEMORY_MB, "DATA_BUILD_MEMORY_MB");
	return { jobs, memoryMb };
}

/** The stage's process-tree RSS estimate, with a fallback for unmeasured stages. */
export function stageMemoryMb(stage) {
	if (stage.memoryMb !== undefined) return stage.memoryMb;
	for (const argument of stage.args ?? []) {
		const match = /^--max-old-space-size=(\d+)$/.exec(argument);
		if (match) return Number(match[1]);
	}
	return DEFAULT_STAGE_MEMORY_MB;
}

/** What `run` resolves to when a trial run found work: run it again in full. */
export const NEEDS_FULL_RUN = "full";

/** Apply calibrated worker limits only where the build needs a smaller profile. */
export function configureStageMemory(stage, memoryMb, env, jobs = Infinity) {
	const compact = stage.compact;
	if (!compact) return stage;
	const {
		variable,
		workers,
		normalWorkers,
		memoryVariable,
		normalBudgetMb = COMPACT_BUILD_MEMORY_MB + 1,
	} = compact;
	if (memoryVariable) {
		const override = Number(env[variable]);
		const requested =
			Number.isInteger(override) && override > 0
				? override
				: memoryMb >= normalBudgetMb
					? (normalWorkers ?? workers)
					: workers;
		const cpuSlots = Math.min(jobs, requested);
		const reservedMb =
			cpuSlots <= workers
				? compact.memoryMb
				: cpuSlots === normalWorkers
					? stageMemoryMb(stage)
					: // Unmeasured worker counts run alone within the build budget.
						Math.max(memoryMb + 1, stageMemoryMb(stage));
		return {
			...stage,
			cpuSlots,
			memoryMb: reservedMb,
			workerEnvironment: {
				...stage.workerEnvironment,
				[variable]: String(cpuSlots),
				[memoryVariable]: String(
					Math.max(compact.memoryMb, Math.min(memoryMb, reservedMb)),
				),
			},
		};
	}
	if (env[variable] !== undefined) {
		const requested = Number(env[variable]);
		if (
			Number.isInteger(requested) &&
			requested > 0 &&
			requested <= workers
		)
			return { ...stage, memoryMb: compact.memoryMb };
		if (requested === normalWorkers) return stage;
		// An explicit worker override is outside the calibrated profiles.
		if (Number.isFinite(memoryMb))
			return {
				...stage,
				memoryMb: Math.max(memoryMb + 1, stageMemoryMb(stage)),
			};
		return stage;
	}
	if (memoryMb >= normalBudgetMb)
		return normalWorkers
			? {
					...stage,
					workerEnvironment: { [variable]: String(normalWorkers) },
				}
			: stage;
	return {
		...stage,
		memoryMb: compact.memoryMb,
		workerEnvironment: { [variable]: String(workers) },
	};
}

/**
 * Budgets a backfill can keep using when the blocked stage becomes ready.
 * Reserve for any subset of current jobs that can coexist with that stage.
 */
function backfillCapacity(memoryMb, cpuSlots, running) {
	if (memoryMb <= 0 || cpuSlots <= 0) return { memoryMb: 0, cpuSlots: 0 };
	const reachable = new Map([[0, new Set([0])]]);
	let peakMb = 0;
	let peakCpu = 0;
	for (const entry of running.values()) {
		const additions = [];
		for (const [usedCpu, memoryCosts] of reachable) {
			const cpu = usedCpu + entry.cpuSlots;
			if (cpu > cpuSlots) continue;
			for (const usedMb of memoryCosts) {
				const mb = usedMb + entry.cost;
				if (mb > memoryMb) continue;
				if (mb === memoryMb || cpu === cpuSlots)
					return { memoryMb: 0, cpuSlots: 0 };
				additions.push([cpu, mb]);
				peakMb = Math.max(peakMb, mb);
				peakCpu = Math.max(peakCpu, cpu);
			}
		}
		for (const [cpu, mb] of additions) {
			if (!reachable.has(cpu)) reachable.set(cpu, new Set());
			reachable.get(cpu).add(mb);
		}
	}
	return { memoryMb: memoryMb - peakMb, cpuSlots: cpuSlots - peakCpu };
}

/**
 * True when the stages may not run at the same time. Every stage owns its
 * paths alone, so stages never wait for each other's files. A stage with no
 * declared paths could touch anything, so it runs alone, and so does one that
 * rewrites files the other stages import.
 */
export function conflicts(a, b) {
	return !stageScope(a) || !stageScope(b) || a.exclusive || b.exclusive;
}

/**
 * For each stage, the planned stages that must finish before it starts: its
 * dependencies, and every earlier stage it conflicts with. Ordering those as
 * the plan does keeps the build as a one-at-a-time build leaves it.
 */
export function blockersOf(stages) {
	const names = new Set(stages.map((stage) => stage.name));
	return new Map(
		stages.map((stage, index) => [
			stage.name,
			new Set([
				...stage.dependencies.filter((name) => names.has(name)),
				...stages
					.slice(0, index)
					.filter((earlier) => conflicts(earlier, stage))
					.map((earlier) => earlier.name),
			]),
		]),
	);
}

/**
 * Orders stages so those with the longest remaining work come first. Ties
 * keep the plan order.
 */
export function priorityOrder(stages, weightOf) {
	const blockers = blockersOf(stages);
	const tail = new Map();
	for (const stage of [...stages].reverse()) {
		let longest = 0;
		for (const later of stages)
			if (blockers.get(later.name).has(stage.name))
				longest = Math.max(longest, tail.get(later.name));
		tail.set(stage.name, longest + weightOf(stage));
	}
	const position = new Map(stages.map((stage, index) => [stage.name, index]));
	return [...stages].sort(
		(a, b) =>
			tail.get(b.name) - tail.get(a.name) ||
			position.get(a.name) - position.get(b.name),
	);
}

/**
 * How long `runSchedule` would take with this `order` if each stage took
 * `durationOf(stage)` milliseconds, replayed on a virtual clock. Every stage
 * runs, and a trial run is taken to find nothing to do.
 *
 * @param {{
 *   stages: Array<{ name: string, dependencies: string[] }>,
 *   order: Array<{ name: string }>,
 *   durationOf: (stage: any) => number,
 *   jobs: number,
 *   memoryMb: number,
 * }} options
 */
export async function simulateSchedule({
	stages,
	order,
	durationOf,
	jobs,
	memoryMb,
}) {
	let now = 0;
	let serial = 0;
	let finished = false;
	const pending = [];
	const done = runSchedule({
		stages,
		order,
		jobs,
		memoryMb,
		clock: () => now,
		settle: () => true,
		run: (stage) =>
			new Promise((resolve) => {
				pending.push({ end: now + durationOf(stage), serial, resolve });
				serial += 1;
			}),
	}).then(() => {
		finished = true;
	});
	// The scheduler reacts to a finished stage over several promise turns.
	const settled = () => new Promise((resolve) => setImmediate(resolve));
	await settled();
	while (!finished && pending.length > 0) {
		pending.sort((a, b) => a.end - b.end || a.serial - b.serial);
		const next = pending.shift();
		now = Math.max(now, next.end);
		next.resolve(true);
		await settled();
	}
	await done;
	return now;
}

/**
 * Searches for a priority order that finishes sooner than `priorityOrder`
 * alone. Longest remaining work first ignores memory, so where the budget is
 * tight a reserved stage can hold back a long one that would have fitted.
 * Each try scales every stage's weight by a random factor and replays the
 * schedule with `weightOf` as its duration. The seed is fixed, so the same
 * timings always give the same order, and the plain order wins ties.
 *
 * @param {{
 *   stages: Array<{ name: string, dependencies: string[] }>,
 *   weightOf: (stage: any) => number,
 *   jobs: number,
 *   memoryMb: number,
 *   tries?: number,
 *   seed?: number,
 * }} options
 * @returns {Promise<{ order: any[], plainMs: number, expectedMs: number }>}
 */
export async function searchPriorityOrder({
	stages,
	weightOf,
	jobs,
	memoryMb,
	tries = 300,
	seed = 1,
}) {
	const replay = (order) =>
		simulateSchedule({
			stages,
			order,
			durationOf: weightOf,
			jobs,
			memoryMb,
		});
	let order = priorityOrder(stages, weightOf);
	const plainMs = await replay(order);
	let expectedMs = plainMs;
	// Park-Miller: small, and the same sequence on every platform.
	let state = seed;
	const random = () => {
		state = (state * 48271) % 2147483647;
		return state / 2147483647;
	};
	for (let index = 0; index < tries; index += 1) {
		const factors = new Map(
			stages.map((stage) => [stage.name, 0.3 + 1.4 * random()]),
		);
		const candidate = priorityOrder(
			stages,
			(stage) => weightOf(stage) * factors.get(stage.name),
		);
		const candidateMs = await replay(candidate);
		if (candidateMs < expectedMs) {
			order = candidate;
			expectedMs = candidateMs;
		}
	}
	return { order, plainMs, expectedMs };
}

/**
 * How the stages that will run line up when only dependencies and conflicts
 * hold them back: the waves of stages that can start together, and the
 * longest chain by weight.
 *
 * @param {Array<{ name: string, dependencies: string[] }>} stages
 * @param {{ runs: Set<string>, weightOf: (stage: any) => number }} options
 */
export function planWaves(stages, { runs, weightOf }) {
	const blockers = blockersOf(stages);
	const wave = new Map();
	const finish = new Map();
	const through = new Map();
	for (const stage of stages) {
		let from = null;
		let waveBefore = 0;
		for (const name of blockers.get(stage.name)) {
			waveBefore = Math.max(waveBefore, wave.get(name));
			if (from === null || finish.get(name) > finish.get(from))
				from = name;
		}
		const before = from === null ? 0 : finish.get(from);
		const runsNow = runs.has(stage.name);
		wave.set(stage.name, waveBefore + (runsNow ? 1 : 0));
		finish.set(stage.name, before + (runsNow ? weightOf(stage) : 0));
		through.set(stage.name, from);
	}
	const waves = [];
	for (const stage of stages)
		if (runs.has(stage.name))
			(waves[wave.get(stage.name) - 1] ??= []).push(stage.name);
	let last = null;
	for (const stage of stages)
		if (
			runs.has(stage.name) &&
			(last === null || finish.get(stage.name) > finish.get(last))
		)
			last = stage.name;
	const criticalPath = [];
	for (let name = last; name !== null; name = through.get(name))
		if (runs.has(name)) criticalPath.unshift(name);
	return {
		waves,
		criticalPath,
		criticalMs: last === null ? 0 : finish.get(last),
		totalMs: stages
			.filter((stage) => runs.has(stage.name))
			.reduce((sum, stage) => sum + weightOf(stage), 0),
	};
}

/**
 * Runs the planned stages, starting each one once everything that blocks it
 * has finished, within the `jobs` CPU slots and `memoryMb` memory budget.
 * `settle(stage)` handles a stage that needs no command and
 * returns true when the stage has to run. `run(stage, waited)` runs it and
 * resolves to false when it failed. `waited` says how long the stage queued
 * after it was settled: `queuedMs` in all, of which `memoryWaitMs` was spent
 * with its CPU slots available, held back by memory.
 *
 * The first stage in `order` that is ready but cannot fit reserves its place.
 * Smaller stages can backfill only if they fit now and would still leave room
 * whenever enough running stages finish to admit the blocked stage.
 *
 * A stage with a `trial` reservation starts as a trial run at that smaller
 * cost and one CPU slot: `run(stage, waited, { trial: true })`. It is usually
 * a cache hit and finishes then. When `run` resolves to `NEEDS_FULL_RUN`, the
 * stage queues again at its full cost, keeping the time it has waited.
 *
 * On a failure no new stage starts, but stages already running finish and are
 * recorded. Killing them could leave half-written files, and their results
 * are worth keeping for the next build. A stage that throws does the same,
 * and the first error is thrown once the running stages have finished.
 *
 * With one job this is the plan order, one stage at a time.
 *
 * @param {{
 *   stages: Array<{ name: string, dependencies: string[], args?: string[], memoryMb?: number, cpuSlots?: number, trial?: { memoryMb: number } }>,
 *   settle: (stage: any) => boolean,
 *   run: (stage: any, waited: { queuedMs: number, memoryWaitMs: number }, options: { trial: boolean }) => Promise<boolean | typeof NEEDS_FULL_RUN>,
 *   jobs?: number,
 *   memoryMb?: number,
 *   order?: Array<{ name: string }>,
 *   clock?: () => number,
 * }} options
 */
export async function runSchedule({
	stages,
	settle,
	run,
	jobs = 1,
	memoryMb = Infinity,
	order = stages,
	clock = () => performance.now(),
}) {
	const blockers = blockersOf(stages);
	const finished = new Set();
	const running = new Map();
	const decisions = new Map();
	const queued = new Map();
	// Stages whose trial run found work to do.
	const fullRuns = new Set();
	const isTrial = (stage) => !!stage.trial && !fullRuns.has(stage.name);
	const costOf = (stage) =>
		isTrial(stage) ? stage.trial.memoryMb : stageMemoryMb(stage);
	const slotsOf = (stage) => (isTrial(stage) ? 1 : (stage.cpuSlots ?? 1));
	let usedMb = 0;
	let usedCpu = 0;
	let lastTick = clock();
	let stopped = false;
	let error = null;

	// Stages that wait for the job limit are not waiting for memory.
	const tick = () => {
		const now = clock();
		const elapsed = Math.max(0, now - lastTick);
		lastTick = now;
		for (const entry of queued.values()) {
			entry.queuedMs += elapsed;
			if (usedCpu + entry.cpuSlots <= jobs) entry.memoryWaitMs += elapsed;
		}
		return now;
	};
	const next = () => {
		tick();
		let backfill;
		for (const stage of order) {
			const { name } = stage;
			if (finished.has(name) || running.has(name)) continue;
			if (![...blockers.get(name)].every((other) => finished.has(other)))
				continue;
			let needsRun = decisions.get(name);
			if (needsRun === undefined) {
				needsRun = settle(stage);
				decisions.set(name, needsRun);
				if (!needsRun) {
					finished.add(name);
					return next();
				}
				queued.set(name, {
					queuedMs: 0,
					memoryWaitMs: 0,
					cpuSlots: slotsOf(stage),
				});
			}
			const cost = costOf(stage);
			const cpuSlots = slotsOf(stage);
			const fitsMemory = running.size === 0 || usedMb + cost <= memoryMb;
			if (
				fitsMemory &&
				usedCpu + cpuSlots <= jobs &&
				(!backfill ||
					(cost <= backfill.memoryMb &&
						cpuSlots <= backfill.cpuSlots))
			)
				return stage;
			backfill ??= backfillCapacity(
				memoryMb - cost,
				jobs - cpuSlots,
				running,
			);
			if (!backfill.memoryMb || !backfill.cpuSlots) return null;
		}
		return null;
	};
	const start = (stage) => {
		const trial = isTrial(stage);
		const cost = costOf(stage);
		const cpuSlots = slotsOf(stage);
		tick();
		const waited = queued.get(stage.name) ?? {
			queuedMs: 0,
			memoryWaitMs: 0,
		};
		queued.delete(stage.name);
		usedMb += cost;
		usedCpu += cpuSlots;
		running.set(stage.name, { cost, cpuSlots });
		running.get(stage.name).promise = (async () => {
			try {
				return await run(
					stage,
					{
						queuedMs: waited.queuedMs,
						memoryWaitMs: waited.memoryWaitMs,
					},
					{ trial },
				);
			} catch (thrown) {
				error ??= thrown;
				return false;
			}
		})().then((outcome) => {
			tick();
			running.delete(stage.name);
			usedMb -= cost;
			usedCpu -= cpuSlots;
			if (trial && outcome === NEEDS_FULL_RUN) {
				fullRuns.add(stage.name);
				queued.set(stage.name, {
					...waited,
					cpuSlots: slotsOf(stage),
				});
				return;
			}
			finished.add(stage.name);
			if (outcome !== true) stopped = true;
		});
	};
	for (;;) {
		try {
			while (!stopped && usedCpu < jobs) {
				const stage = next();
				if (!stage) break;
				start(stage);
			}
		} catch (thrown) {
			error ??= thrown;
			stopped = true;
		}
		if (running.size === 0) break;
		await Promise.race([...running.values()].map((entry) => entry.promise));
	}
	if (error) throw error;
	if (!stopped && finished.size < stages.length)
		throw new Error(
			`Cannot schedule: ${stages
				.filter((stage) => !finished.has(stage.name))
				.map((stage) => stage.name)
				.join(", ")}`,
		);
}
