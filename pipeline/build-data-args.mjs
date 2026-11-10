/**
 * Reads the `pnpm data:build` arguments and rejects invalid combinations.
 * `limits.jobs` is the default job count; `--jobs` overrides it and
 * `--verify-outputs` forces one job.
 *
 * @param {{ argv: string[], stages: { name: string }[], limits: { jobs: number } }} options
 */
export function parseBuildArgs({ argv, stages, limits }) {
	let jobs = limits.jobs;
	let jobsFlag = false;
	let verifyFlag = false;
	let verifyChecks = false;
	let checksOnly = false;
	let verifyOutputs = process.env.DATA_BUILD_VERIFY_OUTPUTS === "1";
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
		} else if (argument === "--verify" && !verifyChecks) {
			verifyChecks = true;
		} else if (argument === "--checks" && !checksOnly) {
			checksOnly = true;
		} else if (
			(argument === "--verify-outputs" ||
				argument === "--check-writes") &&
			!verifyFlag
		) {
			verifyFlag = true;
			verifyOutputs = true;
		} else if (argument === "--jobs" && !jobsFlag) {
			if (!/^[1-9]\d*$/.test(argv[index + 1] ?? ""))
				throw new Error("--jobs requires a positive whole number.");
			jobs = Number(argv[index + 1]);
			jobsFlag = true;
			index += 1;
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
				`Unknown or repeated argument: ${argument}. Usage: pnpm data:build [--only <stage> | --from <stage>] [--plan] [--verbose] [--jobs <n> | --verify-outputs] [--no-cache | --adopt] [--verify | --checks]`,
			);
		}
	}
	if (verifyOutputs && (jobsFlag || adopt || plan))
		throw new Error(
			"--verify-outputs runs one stage at a time and cannot be combined with --jobs, --adopt or --plan.",
		);
	if (verifyOutputs) jobs = 1;
	if (checksOnly && (only !== undefined || from !== undefined || adopt))
		throw new Error(
			"--checks runs the check stages alone and cannot be combined with --only, --from or --adopt.",
		);
	if (checksOnly && verifyChecks)
		throw new Error("--checks already runs the checks; drop --verify.");
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
	return {
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
	};
}
