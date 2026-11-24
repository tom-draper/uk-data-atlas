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
 * On a failure no new stage starts, but stages already running finish and are
 * recorded. Killing them could leave half-written files, and their results
 * are worth keeping for the next build. A stage that throws does the same,
 * and the first error is thrown once the running stages have finished.
 *
 * With one job this is the plan order, one stage at a time.
 *
 * @param {{
 *   stages: Array<{ name: string, dependencies: string[], args?: string[], memoryMb?: number, cpuSlots?: number }>,
 *   settle: (stage: any) => boolean,
 *   run: (stage: any, waited: { queuedMs: number, memoryWaitMs: number }) => Promise<boolean>,
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
					cpuSlots: stage.cpuSlots ?? 1,
				});
			}
			const cost = stageMemoryMb(stage);
			const cpuSlots = stage.cpuSlots ?? 1;
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
		const cost = stageMemoryMb(stage);
		const cpuSlots = stage.cpuSlots ?? 1;
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
				return await run(stage, {
					queuedMs: waited.queuedMs,
					memoryWaitMs: waited.memoryWaitMs,
				});
			} catch (thrown) {
				error ??= thrown;
				return false;
			}
		})().then((succeeded) => {
			tick();
			running.delete(stage.name);
			usedMb -= cost;
			usedCpu -= cpuSlots;
			finished.add(stage.name);
			if (!succeeded) stopped = true;
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
