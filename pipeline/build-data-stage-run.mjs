import { DEFAULT_STAGE_WEIGHT_MS } from "./build-data-scheduler.mjs";
import { plural } from "./build-data-report.mjs";
import {
	formatCount,
	formatDuration,
} from "../packages/atlas-db/src/buildTiming.ts";

/** What the stages did this build, read once they have been settled and run. */
export function createRunState() {
	return {
		started: 0,
		estimated: 0,
		knownEstimates: 0,
		failed: false,
		failureStatus: null,
		undeclaredStages: [],
		mismatchedStages: [],
	};
}

/**
 * The two per-stage steps the scheduler calls. `settle` handles a stage that
 * needs no command (adopted, unchanged or only planned) and returns true when
 * the stage has to run. `run` runs its command and records it. Both note what
 * happened in `state`. `weightOf` is a stage's expected duration.
 *
 * @param {Record<string, any>} context
 */
export function createStageRunner({
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
}) {
	const logCommand = (stage) => {
		log(`  Command: pnpm ${stage.args.join(" ")}`);
		log(`  Depends on: ${stage.dependencies.join(", ") || "none"}`);
	};
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
				if (!plan) recordTiming(stage.name, stageStartedAt, 0, true);
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
				state.estimated += last.totalMs;
				state.knownEstimates += 1;
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
		state.started += 1;
		log(
			`${stage.name}: running (${formatCount(state.started)} of ${formatCount(toRun.size)})`,
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
			state.failed = true;
			state.failureStatus ??= status;
			return false;
		}
		const undeclared = verifyOutputs
			? (cache?.undeclaredChanges(stage) ?? [])
			: [];
		if (undeclared.length) {
			state.undeclaredStages.push(stage.name);
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
			state.mismatchedStages.push(stage.name);
			log(
				`${stage.name}: recorded a hash that does not match ${plural(wrongHashes.length, "file")}`,
			);
			for (const path of wrongHashes.slice(0, 10)) log(`  ${path}`);
			if (wrongHashes.length > 10)
				log(`  and ${formatCount(wrongHashes.length - 10)} more`);
		}
		if (stage.cacheable !== false) digests.set(stage.name, digest ?? null);
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
	return { settle, run, weightOf };
}
