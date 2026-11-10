import { isMainModule } from "./src/lib/entrypoint.ts";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseBuildArgs } from "./build-data-args.mjs";
import {
	createBuildReport,
	formatAssetTree,
	plural,
} from "./build-data-report.mjs";
import {
	planBuild,
	resolveChecks,
	selectStages,
} from "./build-data-select.mjs";
import { createStageCache } from "./build-data-cache.mjs";
import {
	ATLAS_CACHE_WORK_ENV,
	discardAtlasCacheWork,
} from "./src/storage/atlasCacheWork.ts";
import { OUTPUT_MANIFEST_ENV } from "./src/storage/outputManifest.ts";
import { buildDataStages } from "./build-data-graph.mjs";
import {
	DEFAULT_STAGE_WEIGHT_MS,
	planWaves,
	priorityOrder,
	resolveLimits,
	runSchedule,
} from "./build-data-scheduler.mjs";
import {
	buildLog,
	formatBytes,
	formatCount,
	formatDuration,
} from "../packages/atlas-db/src/buildTiming.ts";

export { formatAssetTree, planBuild, resolveChecks };

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

// A stage that always runs reaches later stages through their inputs.
const ALWAYS_RUNS = "always-runs";

/**
 * @typedef {{ name: string, dependencies: string[], args: string[], check?: boolean, cacheable?: boolean, isCurrent?: () => boolean | Promise<boolean>, outputs?: string[], requiredOutputs?: string[], codeInputs?: string[], writes?: string[], rawInputs?: string[] | ((root: string) => string[] | { paths: string[], presence: string[] }) }} Stage
 * @param {{
 *   argv?: string[],
 *   stages?: Stage[],
 *   execute?: (stage: Stage, options: { verbose: boolean, prefixed: boolean, outputManifest?: string }) => number | Promise<number>,
 *   limits?: { jobs: number, memoryMb: number },
 *   log?: (line: string) => void,
 *   logError?: (message: string) => void,
 *   createCache?: () => ReturnType<typeof createStageCache> | null,
 *   discardWork?: () => void,
 *   env?: Record<string, string | undefined>,
 * }} [options]
 */
export async function runBuild({
	argv = [],
	stages = buildDataStages,
	execute = executeStage,
	log = buildLog.info,
	logError = buildLog.error,
	createCache = () => null,
	discardWork = () => {},
	limits = { jobs: 1, memoryMb: Infinity },
	env = process.env,
} = {}) {
	const {
		jobs,
		verifyChecks,
		checksOnly,
		verifyOutputs,
		from,
		only,
		plan,
		adopt,
		verbose,
		useCache,
	} = parseBuildArgs({ argv, stages, limits });
	const { selected, skippedChecks, checks, isCheck } = selectStages({
		stages,
		from,
		only,
		checksOnly,
		verifyChecks,
		env,
	});
	const startedAt = performance.now();
	const buildStartedAt = new Date().toISOString();
	const logCommand = (stage) => {
		log(`  Command: pnpm ${stage.args.join(" ")}`);
		log(`  Depends on: ${stage.dependencies.join(", ") || "none"}`);
	};
	const cache = createCache();
	const { timings, recordTiming, reportSummary } = createBuildReport({
		cache,
		log,
		plan,
		adopt,
		verbose,
		startedAt,
		buildStartedAt,
	});
	let failed = false;
	try {
		if (adopt) {
			if (!cache) throw new Error("--adopt requires a stage cache.");
			cache.validateAdoption(
				selected.filter((stage) => stage.cacheable !== false),
			);
		}
		// Stages that add to a shared file work on a copy until the build
		// publishes it. A copy left by a build that stopped is thrown away
		// before any stage is looked up, with the stamps that vouch for it.
		if (!plan && !adopt && !checksOnly) discardWork();
		// --from and --no-cache rerun every stage they select, and record them.
		const reuse = cache !== null && useCache && from === undefined;
		// A stage that always runs may know its work is already done, and then
		// it is skipped without a command. Its digest is the same either way.
		const current = new Set();
		if (useCache && from === undefined && !adopt)
			for (const stage of selected)
				if (stage.cacheable === false && (await stage.isCurrent?.()))
					current.add(stage.name);
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
				if (current.has(stage.name)) continue;
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
		if (skippedChecks.length)
			log(
				`Parity checks not run (${formatCount(skippedChecks.length)}): ${skippedChecks.join(", ")}. Run them with pnpm data:verify or pnpm data:build --verify.`,
			);
		else if (!adopt && checks.run && selected.some(isCheck))
			log(
				`Parity checks on (${checks.reason}); each reruns only when its inputs or code changed.`,
			);
		if (jobs > 1 && !adopt && !plan)
			log(
				`Running up to ${formatCount(jobs)} stages at once within ${formatCount(Math.round(limits.memoryMb))} MB`,
			);
		log("");
		let started = 0;
		let estimated = 0;
		let knownEstimates = 0;
		let failureStatus = null;
		const undeclaredStages = [];
		const mismatchedStages = [];
		const startedAtOf = new Map();
		// A stage's expected duration: its last run, if it has to run at all.
		const weightOf = (stage) =>
			toRun.has(stage.name)
				? (cache?.lastTiming(stage.name)?.totalMs ??
					DEFAULT_STAGE_WEIGHT_MS)
				: 0;
		// Handles a stage that needs no command: adopted, unchanged or only
		// planned. Returns true when the stage has to run.
		const settle = (stage) => {
			const stageStartedAt = performance.now();
			startedAtOf.set(stage.name, stageStartedAt);
			const dependencies = dependencyDigests(stage);
			if (adopt) {
				if (stage.cacheable === false) {
					log(`${stage.name}: not cacheable, skipped`);
					if (!plan)
						recordTiming(stage.name, stageStartedAt, 0, true);
					return false;
				}
				if (plan) {
					log(`${stage.name}: would adopt existing outputs`);
					return false;
				}
				const adopted = cache.adopt(stage, dependencies);
				digests.set(stage.name, adopted.digest);
				log(
					`${stage.name}: adopted ${plural(adopted.files.length, "output file")}`,
				);
				if (verbose) for (const path of adopted.files) log(`  ${path}`);
				recordTiming(stage.name, stageStartedAt, 0, true);
				return false;
			}
			if (current.has(stage.name)) {
				log(
					`${stage.name}: up to date, ${plan ? "would skip" : "skipped"}`,
				);
				if (plan || verbose) logCommand(stage);
				recordTiming(stage.name, stageStartedAt, 0, true);
				return false;
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
				return false;
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
				return false;
			}
			return true;
		};
		// Runs a stage's command and records it. Returns false when it failed.
		const run = async (stage) => {
			const stageStartedAt = startedAtOf.get(stage.name);
			const dependencies = dependencyDigests(stage);
			started += 1;
			log(
				`${stage.name}: running (${formatCount(started)} of ${formatCount(toRun.size)})`,
			);
			if (verbose) logCommand(stage);
			cache?.begin(stage, { audit: verifyOutputs });
			const commandStartedAt = performance.now();
			let status;
			try {
				status = await execute(stage, {
					verbose,
					prefixed: jobs > 1,
					outputManifest: cache?.manifestPath(stage.name),
				});
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
				failureStatus ??= status;
				return false;
			}
			const undeclared = verifyOutputs
				? (cache?.undeclaredChanges(stage) ?? [])
				: [];
			if (undeclared.length) {
				undeclaredStages.push(stage.name);
				log(
					`${stage.name}: changed ${plural(undeclared.length, "file")} outside its declared writes`,
				);
				for (const path of undeclared.slice(0, 10)) log(`  ${path}`);
				if (undeclared.length > 10)
					log(`  and ${formatCount(undeclared.length - 10)} more`);
			}
			const digest = cache?.record(stage, dependencies, {
				cacheable: stage.cacheable !== false,
				verify: verifyOutputs,
			});
			const wrongHashes = verifyOutputs
				? (cache?.manifestMismatches(stage.name) ?? [])
				: [];
			if (wrongHashes.length) {
				mismatchedStages.push(stage.name);
				log(
					`${stage.name}: recorded a hash that does not match ${plural(wrongHashes.length, "file")}`,
				);
				for (const path of wrongHashes.slice(0, 10)) log(`  ${path}`);
				if (wrongHashes.length > 10)
					log(`  and ${formatCount(wrongHashes.length - 10)} more`);
			}
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
			return true;
		};
		if (adopt || plan) for (const stage of selected) settle(stage);
		else {
			await runSchedule({
				stages: selected,
				settle,
				run,
				jobs,
				memoryMb: limits.memoryMb,
				order: jobs > 1 ? priorityOrder(selected, weightOf) : selected,
			});
		}
		if (undeclaredStages.length)
			log(
				`Undeclared writes in ${plural(undeclaredStages.length, "stage")}: ${undeclaredStages.join(", ")}. Declare their writes in the stage definition.`,
			);
		if (mismatchedStages.length)
			log(
				`Wrong output hashes in ${plural(mismatchedStages.length, "stage")}: ${mismatchedStages.join(", ")}. Each recorded a hash its file does not have, so the build would have trusted it.`,
			);
		if (failureStatus !== null) {
			discardWork();
			return failureStatus;
		}
		// An undeclared write is a bug in the graph: the cache would not see it.
		if (undeclaredStages.length || mismatchedStages.length) {
			logError("Output verification failed.");
			return 1;
		}
		if (plan && knownEstimates)
			log(
				`Estimated total: ${formatDuration(estimated)} for ${knownEstimates} of ${toRun.size} stages to run`,
			);
		if (plan && !adopt && toRun.size > 0) {
			const schedule = planWaves(selected, { runs: toRun, weightOf });
			log("");
			log(
				`Parallel schedule (stages in a wave can run together; up to ${formatCount(jobs)} at once within ${formatCount(Math.round(limits.memoryMb))} MB):`,
			);
			schedule.waves.forEach((names, index) =>
				log(`  ${index + 1}. ${names.join(", ")}`),
			);
			log(
				`Critical path: ${schedule.criticalPath.join(" > ")}${knownEstimates === toRun.size ? ` (${formatDuration(schedule.criticalMs)} of ${formatDuration(schedule.totalMs)} in all)` : ""}`,
			);
		}
		return 0;
	} catch (error) {
		failed = true;
		if (!plan && !adopt) discardWork();
		throw error;
	} finally {
		reportSummary(failed);
	}
}

const relayScript = fileURLToPath(
	new URL("./build-data-relay.mjs", import.meta.url),
);

/**
 * Runs the stage's command with its output indented under the stage line, or
 * with the stage's name in front of each line when stages run at once. The
 * relay prefixes each line of stdout and stderr as it arrives.
 */
function executeStage(
	stage,
	{ verbose = false, prefixed = false, outputManifest } = {},
) {
	const env = { ...process.env };
	delete env.DATA_BUILD_RELAY_PREFIX;
	delete env[OUTPUT_MANIFEST_ENV];
	// Where the stage may note the hashes of files it hashed while writing.
	if (outputManifest) env[OUTPUT_MANIFEST_ENV] = outputManifest;
	// Stages add to shared files in a working copy, which the build publishes.
	env[ATLAS_CACHE_WORK_ENV] = "1";
	if (verbose) env.DATA_BUILD_VERBOSE = "1";
	if (prefixed) env.DATA_BUILD_RELAY_PREFIX = `  [${stage.name}] `;
	return new Promise((resolveStatus, reject) => {
		const child = spawn(
			process.execPath,
			[
				relayScript,
				stage.name === "sources" ? "pnpm" : process.execPath,
				...stage.args,
			],
			{ cwd: repositoryRoot, stdio: "inherit", env },
		);
		child.once("error", (error) =>
			reject(
				new Error(`Cannot start stage ${stage.name}: ${error.message}`),
			),
		);
		child.once("close", (status, signal) => {
			if (signal)
				reject(
					new Error(
						`${stage.name} was terminated by ${signal}. Build stopped`,
					),
				);
			else resolveStatus(status ?? 1);
		});
	});
}

if (isMainModule(import.meta.url)) {
	try {
		process.exitCode = await runBuild({
			argv: process.argv.slice(2),
			createCache: createStageCache,
			discardWork: () => discardAtlasCacheWork(repositoryRoot),
			limits: resolveLimits(),
		});
	} catch (error) {
		buildLog.error(error.message);
		process.exitCode = 1;
	}
}
