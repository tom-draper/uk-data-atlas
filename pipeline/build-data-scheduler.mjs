import { availableParallelism, freemem, totalmem } from "node:os";
import { stageScope } from "./build-data-cache.mjs";

/** What a stage costs when its command sets no `--max-old-space-size`. */
export const DEFAULT_STAGE_MEMORY_MB = 1024;
/** Plan weight of a stage that has no recorded timing. */
export const DEFAULT_STAGE_WEIGHT_MS = 1000;
/**
 * A stage started ahead of a waiting one is assumed to take this many times
 * its recorded duration, so that a slower run does not delay the waiting stage.
 */
export const BACKFILL_MARGIN = 1.25;

const MEBIBYTE = 1024 * 1024;

const positiveInteger = (value, label) => {
	if (!/^[1-9]\d*$/.test(String(value)))
		throw new Error(`${label} must be a positive whole number.`);
	return Number(value);
};

/**
 * How many stages may run at once, and the memory they may use together.
 * Jobs default to the CPU count. The memory budget defaults to the free
 * memory now, capped at three quarters of the total. Override them with
 * DATA_BUILD_JOBS and DATA_BUILD_MEMORY_MB.
 *
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   cpus?: number,
 *   totalMemory?: number,
 *   freeMemory?: number,
 * }} [options]
 */
export function resolveLimits({
	env = process.env,
	cpus = availableParallelism(),
	totalMemory = totalmem(),
	freeMemory = freemem(),
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
						Math.min(freeMemory, totalMemory * 0.75) / MEBIBYTE,
					),
				)
			: positiveInteger(env.DATA_BUILD_MEMORY_MB, "DATA_BUILD_MEMORY_MB");
	return { jobs, memoryMb };
}

/** The memory a stage is budgeted: its V8 heap limit, else a default. */
export function stageMemoryMb(stage) {
	for (const argument of stage.args ?? []) {
		const match = /^--max-old-space-size=(\d+)$/.exec(argument);
		if (match) return Number(match[1]);
	}
	return DEFAULT_STAGE_MEMORY_MB;
}

const isDuration = (value) =>
	typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * How long a stage is expected to hold its slot, from its last recorded
 * timing, or null when there is no usable record. A failed run, a missing
 * record and a record with a bad number all give null, and the scheduler then
 * assumes nothing about the stage. When the record says how long the stage
 * queued, that is taken off the total, since the total includes it.
 */
export function expectedDurationMs(timing) {
	if (!timing || typeof timing !== "object" || timing.failed === true)
		return null;
	const { commandMs, totalMs, queueMs } = timing;
	if (!isDuration(commandMs)) return null;
	if (isDuration(totalMs) && isDuration(queueMs) && totalMs >= queueMs)
		return Math.max(commandMs, totalMs - queueMs);
	return commandMs;
}

const overlaps = (a, b) =>
	a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/** True when the stages may not run at the same time. */
export function conflicts(a, b) {
	const first = stageScope(a);
	const second = stageScope(b);
	// A stage with no declared paths could touch anything, so it runs alone.
	// So does one that rewrites files the other stages import.
	if (!first || !second || a.exclusive || b.exclusive) return true;
	return first.some((path) => second.some((other) => overlaps(path, other)));
}

/**
 * For each stage, the planned stages that must finish before it starts: its
 * dependencies, and every earlier stage it conflicts with. Ordering conflicting
 * stages as the plan does keeps their outputs and the cache as a one-at-a-time
 * build leaves them.
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
 * has finished, with at most `jobs` running and their memory within
 * `memoryMb`. `settle(stage)` handles a stage that needs no command and
 * returns true when the stage has to run. `run(stage, waited)` runs it and
 * resolves to false when it failed. `waited` says how long the stage queued
 * after it was settled: `queuedMs` in all, of which `memoryWaitMs` was spent
 * with a free job slot, held back by memory.
 *
 * The first stage in `order` that is ready but does not fit in the memory left
 * is the one waiting. Nothing may start ahead of it unless it cannot delay
 * it: a smaller stage starts early only when it is expected to finish before
 * the waiting stage can start, or when it leaves room for the waiting stage
 * even if it is still running by then. `expectedMs(stage)` gives a stage's
 * expected duration, or null when it is not known. When the running stages'
 * durations are not all known, nothing starts ahead of the waiting stage.
 * Estimates can be wrong, but a stage that overruns only delays the waiting
 * stage until it finishes, so the waiting stage still starts.
 *
 * On a failure no new stage starts, but stages already running finish and are
 * recorded. Killing them could leave half-written files, and their results
 * are worth keeping for the next build. A stage that throws does the same,
 * and the first error is thrown once the running stages have finished.
 *
 * With one job this is the plan order, one stage at a time.
 *
 * @param {{
 *   stages: Array<{ name: string, dependencies: string[], args?: string[] }>,
 *   settle: (stage: any) => boolean,
 *   run: (stage: any, waited: { queuedMs: number, memoryWaitMs: number }) => Promise<boolean>,
 *   jobs?: number,
 *   memoryMb?: number,
 *   order?: Array<{ name: string }>,
 *   clock?: () => number,
 *   expectedMs?: (stage: any) => number | null | undefined,
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
	expectedMs = () => null,
}) {
	const blockers = blockersOf(stages);
	const finished = new Set();
	const running = new Map();
	const decisions = new Map();
	const queued = new Map();
	let usedMb = 0;
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
			if (running.size < jobs) entry.memoryWaitMs += elapsed;
		}
		return now;
	};
	const fits = (stage) =>
		running.size === 0 || usedMb + stageMemoryMb(stage) <= memoryMb;
	// When the waiting stage could start, going by when the running stages are
	// expected to finish, and the room that is left beside it by then. Null
	// when a running stage has no expected duration.
	const reserve = (waiting, now) => {
		const releases = [];
		for (const [name, entry] of running) {
			if (entry.end === null) return null;
			releases.push({ name, ...entry, end: Math.max(entry.end, now) });
		}
		releases.sort((a, b) => a.end - b.end || (a.name < b.name ? -1 : 1));
		// A stage larger than the budget waits for the others to finish.
		const need = Math.min(stageMemoryMb(waiting), memoryMb);
		let used = usedMb;
		for (const release of releases) {
			used -= release.cost;
			if (used + need <= memoryMb) {
				const still = releases.filter(
					(other) => other.end > release.end,
				);
				return {
					startsAt: release.end,
					spareMb:
						memoryMb -
						need -
						still.reduce((sum, other) => sum + other.cost, 0),
					stillRunning: still.length,
				};
			}
		}
		return null;
	};
	const cannotDelay = (stage, reservation, now) => {
		if (!reservation) return false;
		const cost = stageMemoryMb(stage);
		if (usedMb + cost > memoryMb) return false;
		const duration = expectedMs(stage);
		if (
			typeof duration === "number" &&
			Number.isFinite(duration) &&
			duration >= 0 &&
			now + duration * BACKFILL_MARGIN <= reservation.startsAt
		)
			return true;
		// Still running when the waiting stage starts: it needs the room, and a
		// job slot beside the waiting stage's.
		return (
			cost <= reservation.spareMb && reservation.stillRunning + 2 <= jobs
		);
	};
	const next = () => {
		const now = tick();
		let waiting = null;
		let reservation = null;
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
				queued.set(name, { queuedMs: 0, memoryWaitMs: 0 });
			}
			if (waiting === null) {
				if (fits(stage)) return stage;
				waiting = stage;
				reservation = reserve(stage, now);
			} else if (cannotDelay(stage, reservation, now)) return stage;
		}
		return null;
	};
	const start = (stage) => {
		const cost = stageMemoryMb(stage);
		const now = tick();
		const waited = queued.get(stage.name) ?? {
			queuedMs: 0,
			memoryWaitMs: 0,
		};
		queued.delete(stage.name);
		const duration = expectedMs(stage);
		const end =
			typeof duration === "number" &&
			Number.isFinite(duration) &&
			duration >= 0
				? now + duration
				: null;
		usedMb += cost;
		running.set(stage.name, { cost, end });
		running.get(stage.name).promise = (async () => {
			try {
				return await run(stage, { ...waited });
			} catch (thrown) {
				error ??= thrown;
				return false;
			}
		})().then((succeeded) => {
			tick();
			running.delete(stage.name);
			usedMb -= cost;
			finished.add(stage.name);
			if (!succeeded) stopped = true;
		});
	};
	for (;;) {
		try {
			while (!stopped && running.size < jobs) {
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
