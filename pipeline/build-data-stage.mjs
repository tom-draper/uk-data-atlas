import { STAMP_DIRECTORY } from "./src/storage/stageStamp.ts";

const stage = (
	name,
	dependencies = [],
	args,
	{
		cacheable = true,
		check = false,
		exclusive = false,
		isCurrent,
		outputs = [],
		requiredOutputs = [],
		codeInputs = [],
		rawInputs,
		shared = [],
		scratch = [],
		finishedBy,
		writes = [],
	} = {},
) => ({
	name,
	dependencies,
	args,
	cacheable,
	check,
	exclusive,
	isCurrent,
	outputs,
	requiredOutputs,
	codeInputs,
	rawInputs,
	shared,
	scratch,
	finishedBy,
	writes,
});

const stampOf = (stage) => `${STAMP_DIRECTORY}/${stage}.json`;

/**
 * A check stage: an exact-copy (parity) check kept apart from the stage that
 * writes the output it checks, so that stage writes once and computes no
 * second copy. It reads outputs, writes only a stamp, and nothing depends on
 * it. A local build leaves it out; `--verify`, `DATA_BUILD_VERIFY=1`, CI and
 * `pnpm data:verify` run it. Like any stage it is keyed on its code and its
 * dependencies' output digests, so once it has passed it is skipped until
 * one of those changes. The script is `pipeline/src/stages/<name>.ts`.
 */
const checkStage = (name, dependencies, args, options = {}) =>
	stage(name, dependencies, args, {
		rawInputs: [],
		requiredOutputs: [stampOf(name)],
		...options,
		check: true,
	});

export { stage, checkStage, stampOf };
