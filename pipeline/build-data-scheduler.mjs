import { availableParallelism, freemem, totalmem } from "node:os";
import { stageScope } from "./build-data-cache.mjs";

/** What a stage costs when its command sets no `--max-old-space-size`. */
export const DEFAULT_STAGE_MEMORY_MB = 1024;
/** Plan weight of a stage that has no recorded timing. */
export const DEFAULT_STAGE_WEIGHT_MS = 1000;

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
 * returns true when the stage has to run. `run(stage)` runs it and resolves
 * to false when it failed.
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
 *   run: (stage: any) => Promise<boolean>,
 *   jobs?: number,
 *   memoryMb?: number,
 *   order?: Array<{ name: string }>,
 * }} options
 */
export async function runSchedule({
	stages,
	settle,
	run,
	jobs = 1,
	memoryMb = Infinity,
	order = stages,
}) {
	const blockers = blockersOf(stages);
	const finished = new Set();
	const running = new Map();
	const decisions = new Map();
	let usedMb = 0;
	let stopped = false;
	let error = null;

	const next = () => {
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
			}
			// Wait for memory rather than start smaller stages ahead of it.
			if (running.size > 0 && usedMb + stageMemoryMb(stage) > memoryMb)
				return null;
			return stage;
		}
		return null;
	};
	const start = (stage) => {
		const cost = stageMemoryMb(stage);
		usedMb += cost;
		running.set(
			stage.name,
			(async () => {
				try {
					return await run(stage);
				} catch (thrown) {
					error ??= thrown;
					return false;
				}
			})().then((succeeded) => {
				running.delete(stage.name);
				usedMb -= cost;
				finished.add(stage.name);
				if (!succeeded) stopped = true;
			}),
		);
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
		await Promise.race(running.values());
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
