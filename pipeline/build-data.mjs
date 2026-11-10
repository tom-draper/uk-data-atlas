import { isMainModule } from "./src/lib/entrypoint.ts";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseBuildArgs } from "./build-data-args.mjs";
import {
	createBuildReport,
	logBuildHeader,
	logPlanForecast,
	logRunProblems,
} from "./build-data-report.mjs";
import {
	planBuild,
	resolveChecks,
	selectStages,
} from "./build-data-select.mjs";
import { createRunState, createStageRunner } from "./build-data-stage-run.mjs";
import {
	createDigestTracker,
	findCurrentStages,
} from "./build-data-digests.mjs";
import { createStageCache } from "./build-data-cache.mjs";
import {
	ATLAS_CACHE_WORK_ENV,
	discardAtlasCacheWork,
} from "./src/storage/atlasCacheWork.ts";
import { OUTPUT_MANIFEST_ENV } from "./src/storage/outputManifest.ts";
import { buildDataStages } from "./build-data-graph.mjs";
import {
	priorityOrder,
	resolveLimits,
	runSchedule,
} from "./build-data-scheduler.mjs";
import { buildLog } from "../packages/atlas-db/src/buildTiming.ts";

export { planBuild, resolveChecks };
export { formatAssetTree } from "./build-data-report.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

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
	const state = createRunState();
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
		const current =
			useCache && from === undefined && !adopt
				? await findCurrentStages(selected)
				: new Set();
		const { digests, dependencyDigests, reusableDigest, stagesToRun } =
			createDigestTracker({ stages, selected, cache, reuse, current });
		const toRun = adopt ? new Set() : stagesToRun();
		logBuildHeader({
			log,
			adopt,
			plan,
			selected,
			toRun,
			skippedChecks,
			checks,
			isCheck,
			jobs,
			memoryMb: limits.memoryMb,
		});
		const { settle, run, weightOf } = createStageRunner({
			state,
			log,
			logError,
			execute,
			cache,
			adopt,
			plan,
			verbose,
			verifyOutputs,
			jobs,
			toRun,
			current,
			digests,
			dependencyDigests,
			reusableDigest,
			recordTiming,
			timings,
		});
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
		logRunProblems({ log, ...state });
		if (state.failureStatus !== null) {
			discardWork();
			return state.failureStatus;
		}
		// An undeclared write is a bug in the graph: the cache would not see it.
		if (state.undeclaredStages.length || state.mismatchedStages.length) {
			logError("Output verification failed.");
			return 1;
		}
		logPlanForecast({
			log,
			plan,
			adopt,
			selected,
			toRun,
			jobs,
			memoryMb: limits.memoryMb,
			estimated: state.estimated,
			knownEstimates: state.knownEstimates,
			weightOf,
		});
		return 0;
	} catch (error) {
		state.failed = true;
		if (!plan && !adopt) discardWork();
		throw error;
	} finally {
		reportSummary(state.failed);
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
