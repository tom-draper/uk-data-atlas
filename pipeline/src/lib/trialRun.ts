import { buildLog } from "../../../packages/atlas-db/src/buildTiming.ts";

/**
 * A trial run: the build starts a stage that is usually a cache hit with a
 * small memory reservation and `DATA_BUILD_TRIAL=1`. When every result is
 * cached the stage finishes as it always would. When something must be
 * rebuilt it exits with `TRIAL_EXIT_CODE` before writing anything, and the
 * build runs it again with its full reservation.
 */
export const TRIAL_EXIT_CODE = 75;

export const TRIAL_ENVIRONMENT = "DATA_BUILD_TRIAL";

/** Thrown by a trial run that has work to do. */
export class FullRunNeeded extends Error {
	constructor(work: string) {
		super(`Trial run stopped: ${work} must be rebuilt.`);
		this.name = "FullRunNeeded";
	}
}

export const isTrialRun = (env: NodeJS.ProcessEnv = process.env) =>
	env[TRIAL_ENVIRONMENT] === "1";

/** In a trial run, stop before writing when `count` items must be rebuilt. */
export function stopTrialIfWork(count: number, work: string) {
	if (count > 0 && isTrialRun()) throw new FullRunNeeded(`${count} ${work}`);
}

/** Runs a stage entry point, turning a stopped trial into its exit code. */
export async function runTrialable(main: () => Promise<unknown>) {
	try {
		await main();
	} catch (error) {
		if (!(error instanceof FullRunNeeded)) throw error;
		buildLog.info(error.message);
		process.exitCode = TRIAL_EXIT_CODE;
	}
}
