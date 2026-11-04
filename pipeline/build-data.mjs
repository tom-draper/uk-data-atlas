import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStageCache } from "./build-data-cache.mjs";
import { buildDataStages } from "./build-data-graph.mjs";
import {
	buildLog,
	formatCount,
	formatDuration,
} from "../packages/atlas-runtime/src/storage/buildTiming.ts";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

/**
 * The stages to run, in dependency order. `roots` limits the build to those
 * stages and their dependencies; `from` then keeps only that stage and the
 * stages after it.
 */
export function planBuild(stages, from, roots) {
	const byName = new Map();
	for (const stage of stages) {
		if (byName.has(stage.name))
			throw new Error(`Duplicate stage: ${stage.name}`);
		byName.set(stage.name, stage);
	}
	const visiting = new Set();
	const visited = new Set();
	const ordered = [];
	const visit = (name) => {
		if (visiting.has(name))
			throw new Error(`Dependency cycle at stage: ${name}`);
		if (visited.has(name)) return;
		const stage = byName.get(name);
		if (!stage) throw new Error(`Unknown dependency: ${name}`);
		visiting.add(name);
		for (const dependency of stage.dependencies) visit(dependency);
		visiting.delete(name);
		visited.add(name);
		ordered.push(stage);
	};
	for (const stage of stages) visit(stage.name);
	let planned = ordered;
	if (roots !== undefined) {
		const needed = new Set();
		const need = (name) => {
			if (needed.has(name)) return;
			const stage = byName.get(name);
			if (!stage) throw new Error(`Unknown target stage: ${name}`);
			needed.add(name);
			for (const dependency of stage.dependencies) need(dependency);
		};
		for (const root of roots) need(root);
		planned = ordered.filter((stage) => needed.has(stage.name));
	}
	if (from === undefined) return planned;
	if (!byName.has(from)) {
		throw new Error(
			`Unknown stage: ${from}. Available stages: ${[...byName.keys()].join(", ")}`,
		);
	}
	if (!planned.some((stage) => stage.name === from))
		throw new Error(`Stage ${from} is not part of the selected build.`);
	const selected = new Set([from]);
	for (const stage of planned) {
		if (stage.dependencies.some((dependency) => selected.has(dependency))) {
			selected.add(stage.name);
		}
	}
	return planned.filter((stage) => selected.has(stage.name));
}

// A stage that always runs reaches later stages through their inputs.
const ALWAYS_RUNS = "always-runs";

const plural = (count, noun) =>
	`${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;

/**
 * @typedef {{ name: string, dependencies: string[], args: string[], cacheable?: boolean, outputs?: string[], requiredOutputs?: string[], codeInputs?: string[] }} Stage
 * @param {{
 *   argv?: string[],
 *   stages?: Stage[],
 *   execute?: (stage: Stage, options: { verbose: boolean }) => number,
 *   log?: (line: string) => void,
 *   logError?: (message: string) => void,
 *   createCache?: () => ReturnType<typeof createStageCache> | null,
 * }} [options]
 */
export function runBuild({
	argv = [],
	stages = buildDataStages,
	execute = executeStage,
	log = buildLog.info,
	logError = buildLog.error,
	createCache = () => null,
} = {}) {
	let from;
	let only;
	let plan = false;
	let adopt = false;
	let verbose = process.env.DATA_BUILD_VERBOSE === "1";
	let useCache = true;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--adopt" && !adopt) {
			adopt = true;
		} else if (argument === "--plan" && !plan) {
			plan = true;
		} else if (argument === "--verbose" && !verbose) {
			verbose = true;
		} else if (argument === "--no-cache" && useCache) {
			useCache = false;
		} else if (argument === "--only" && only === undefined) {
			only = argv[index + 1];
			if (!only || only.startsWith("--"))
				throw new Error("--only requires a stage name.");
			index += 1;
		} else if (argument === "--from" && from === undefined) {
			from = argv[index + 1];
			if (!from || from.startsWith("--"))
				throw new Error("--from requires a stage name.");
			index += 1;
		} else {
			throw new Error(
				`Unknown or repeated argument: ${argument}. Usage: pnpm data:build [--only <stage> | --from <stage>] [--plan] [--verbose] [--no-cache | --adopt]`,
			);
		}
	}
	if (adopt && (!useCache || from !== undefined))
		throw new Error(
			"--adopt cannot be combined with --no-cache or --from.",
		);
	if (only !== undefined && from !== undefined)
		throw new Error("--only and --from cannot be combined.");
	if (only !== undefined && !stages.some((stage) => stage.name === only))
		throw new Error(
			`Unknown stage: ${only}. Available stages: ${stages.map((stage) => stage.name).join(", ")}`,
		);
	const selected = planBuild(
		stages,
		from,
		only === undefined ? undefined : [only],
	);
	const startedAt = performance.now();
	const buildStartedAt = new Date().toISOString();
	const timings = [];
	const recordTiming = (name, startedAt, command = 0, skipped = false) => {
		const total = performance.now() - startedAt;
		timings.push({
			name,
			total,
			command,
			overhead: total - command,
			skipped,
		});
		return total;
	};
	const reportSummary = (failed) => {
		if (plan) return;
		cache?.writeBuildSummary({
			startedAt: buildStartedAt,
			finishedAt: new Date().toISOString(),
			totalMs: performance.now() - startedAt,
			failed,
			stages: timings.map(
				({ name, total, command, skipped, failed }) => ({
					name,
					status: failed ? "failed" : skipped ? "skipped" : "ran",
					totalMs: total,
					commandMs: command,
				}),
			),
		});
		const ran = timings.filter((timing) => !timing.skipped);
		const unchanged = timings.length - ran.length;
		const elapsed = formatDuration(performance.now() - startedAt);
		log("");
		log(
			failed
				? `Data build failed after ${elapsed} (${formatCount(Math.max(0, ran.length - 1))} ran, 1 failed, ${formatCount(unchanged)} unchanged)`
				: `Data build done in ${elapsed} (${formatCount(ran.length)} ran, ${formatCount(unchanged)} unchanged)`,
		);
		const slowest = [...ran].sort((a, b) => b.total - a.total).slice(0, 5);
		if (slowest.length === 0) return;
		const width = Math.max(...slowest.map((timing) => timing.name.length));
		log("Slowest stages:");
		for (const timing of slowest)
			log(
				`  ${timing.name.padEnd(width)}  ${formatDuration(timing.total)}${verbose ? ` (command ${formatDuration(timing.command)}, overhead ${formatDuration(timing.overhead)})` : ""}`,
			);
	};
	const logCommand = (stage) => {
		log(`  Command: pnpm ${stage.args.join(" ")}`);
		log(`  Depends on: ${stage.dependencies.join(", ") || "none"}`);
	};
	const cache = createCache();
	let failed = false;
	try {
		if (adopt) {
			if (!cache) throw new Error("--adopt requires a stage cache.");
			cache.validateAdoption(
				selected.filter((stage) => stage.cacheable !== false),
			);
		}
		// --from and --no-cache rerun every stage they select, and record them.
		const reuse = cache !== null && useCache && from === undefined;
		// Each stage's output digest this build, or null once a stage has to run
		// (in a plan, its outputs are not known until it does).
		const alwaysRunning = () =>
			new Map(
				stages
					.filter((stage) => stage.cacheable === false)
					.map((stage) => [stage.name, ALWAYS_RUNS]),
			);
		const digests = alwaysRunning();
		const dependencyDigests = (stage, known = digests) =>
			stage.dependencies.map((name) =>
				known.has(name)
					? known.get(name)
					: (cache?.outputDigest(name) ?? null),
			);
		const reusableDigest = (stage, dependencies) =>
			reuse && stage.cacheable !== false && !dependencies.includes(null)
				? cache.lookup(stage, dependencies)
				: null;
		// The stages that will run if nothing a stage rewrites turns out to be
		// unchanged. A stage that runs can leave its outputs as they were, so
		// the build may run fewer.
		const stagesToRun = () => {
			const toRun = new Set();
			const known = alwaysRunning();
			for (const stage of selected) {
				const reused = reusableDigest(
					stage,
					dependencyDigests(stage, known),
				);
				if (reused !== null) known.set(stage.name, reused);
				else {
					toRun.add(stage.name);
					if (stage.cacheable !== false) known.set(stage.name, null);
				}
			}
			return toRun;
		};
		const toRun = adopt ? new Set() : stagesToRun();
		log(
			adopt
				? `Data build: adopting existing outputs for ${plural(selected.length, "stage")}`
				: `Data build${plan ? " plan" : ""}: ${plural(selected.length, "stage")}, ${formatCount(toRun.size)} to run, ${formatCount(selected.length - toRun.size)} unchanged`,
		);
		log("");
		let started = 0;
		let estimated = 0;
		let knownEstimates = 0;
		for (const stage of selected) {
			const stageStartedAt = performance.now();
			const dependencies = dependencyDigests(stage);
			if (adopt) {
				if (stage.cacheable === false) {
					log(`${stage.name}: not cacheable, skipped`);
					if (!plan)
						recordTiming(stage.name, stageStartedAt, 0, true);
					continue;
				}
				if (plan) {
					log(`${stage.name}: would adopt existing outputs`);
					continue;
				}
				const adopted = cache.adopt(stage, dependencies);
				digests.set(stage.name, adopted.digest);
				log(
					`${stage.name}: adopted ${plural(adopted.files.length, "output file")}`,
				);
				if (verbose) for (const path of adopted.files) log(`  ${path}`);
				recordTiming(stage.name, stageStartedAt, 0, true);
				continue;
			}
			const reused = reusableDigest(stage, dependencies);
			if (reused !== null) {
				const last = cache?.lastTiming(stage.name);
				log(
					`${stage.name}: unchanged, ${plan ? `would skip${last ? ` (last run ${formatDuration(last.totalMs)})` : ""}` : "skipped"}`,
				);
				if (plan || verbose) logCommand(stage);
				digests.set(stage.name, reused);
				recordTiming(stage.name, stageStartedAt, 0, true);
				continue;
			}
			if (plan) {
				const last = cache?.lastTiming(stage.name);
				if (last) {
					estimated += last.totalMs;
					knownEstimates += 1;
				}
				log(
					`${stage.name}: would run${last ? ` (last run ${formatDuration(last.totalMs)})` : ""}`,
				);
				logCommand(stage);
				if (stage.cacheable !== false) digests.set(stage.name, null);
				continue;
			}
			started += 1;
			log(
				`${stage.name}: running (${formatCount(started)} of ${formatCount(toRun.size)})`,
			);
			if (verbose) logCommand(stage);
			cache?.begin(stage.name);
			const commandStartedAt = performance.now();
			let status;
			try {
				status = execute(stage, { verbose });
			} catch (error) {
				const command = performance.now() - commandStartedAt;
				const total = recordTiming(stage.name, stageStartedAt, command);
				timings.at(-1).failed = true;
				cache?.recordTiming(stage.name, {
					commandMs: command,
					totalMs: total,
					finishedAt: new Date().toISOString(),
					failed: true,
				});
				throw error;
			}
			const command = performance.now() - commandStartedAt;
			if (status !== 0) {
				logError(
					`${stage.name} failed with exit code ${status} after ${formatDuration(command)}. Build stopped`,
				);
				const total = recordTiming(stage.name, stageStartedAt, command);
				timings.at(-1).failed = true;
				cache?.recordTiming(stage.name, {
					commandMs: command,
					totalMs: total,
					finishedAt: new Date().toISOString(),
					failed: true,
				});
				failed = true;
				return status;
			}
			const digest = cache?.record(stage, dependencies, {
				cacheable: stage.cacheable !== false,
			});
			if (stage.cacheable !== false)
				digests.set(stage.name, digest ?? null);
			const total = recordTiming(stage.name, stageStartedAt, command);
			cache?.recordTiming(stage.name, {
				commandMs: command,
				totalMs: total,
				finishedAt: new Date().toISOString(),
				failed: false,
			});
			log(`${stage.name}: done in ${formatDuration(total)}`);
		}
		if (plan && knownEstimates)
			log(
				`Estimated total: ${formatDuration(estimated)} for ${knownEstimates} of ${toRun.size} stages to run`,
			);
		return 0;
	} catch (error) {
		failed = true;
		throw error;
	} finally {
		reportSummary(failed);
	}
}

const relayScript = fileURLToPath(
	new URL("./build-data-relay.mjs", import.meta.url),
);

/**
 * Runs the stage's command with its output indented under the stage line.
 * The relay prefixes each line of stdout and stderr as it arrives.
 */
function executeStage(stage, { verbose = false } = {}) {
	const result = spawnSync(
		process.execPath,
		[
			relayScript,
			stage.name === "sources" ? "pnpm" : process.execPath,
			...stage.args,
		],
		{
			cwd: repositoryRoot,
			stdio: "inherit",
			env: verbose
				? { ...process.env, DATA_BUILD_VERBOSE: "1" }
				: process.env,
		},
	);
	if (result.error)
		throw new Error(
			`Cannot start stage ${stage.name}: ${result.error.message}`,
		);
	if (result.signal)
		throw new Error(
			`${stage.name} was terminated by ${result.signal}. Build stopped`,
		);
	return result.status ?? 1;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		process.exitCode = runBuild({
			argv: process.argv.slice(2),
			createCache: createStageCache,
		});
	} catch (error) {
		buildLog.error(error.message);
		process.exitCode = 1;
	}
}
