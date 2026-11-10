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
			// Work left in a shared scratch file is lost unless this stage runs.
			if (stage.finishedBy) need(stage.finishedBy);
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

const switchedOn = (value) =>
	value !== undefined && !["", "0", "false"].includes(value.toLowerCase());

/**
 * Whether the build runs its check stages, the exact-copy (parity) checks
 * that rebuild an output a second way and compare it with the first. A local
 * build skips them. `--verify`, `DATA_BUILD_VERIFY=1` and CI (a truthy `CI`,
 * which GitHub Actions sets) switch them on, and `pnpm data:verify` runs them
 * with `--checks`. Once on, the stage cache decides which actually run: a
 * check is skipped while its inputs and code are unchanged since it passed.
 *
 * @param {{ flag?: boolean, env?: Record<string, string | undefined> }} [options]
 */
export function resolveChecks({ flag = false, env = process.env } = {}) {
	if (flag) return { run: true, reason: "--verify" };
	if (env.DATA_BUILD_VERIFY === "1")
		return { run: true, reason: "DATA_BUILD_VERIFY=1" };
	if (switchedOn(env.CI)) return { run: true, reason: "CI" };
	return { run: false, reason: undefined };
}

/**
 * Picks the stages a build covers: the planned stages, minus the check
 * stages when the build is not running them. A check named with `--only` is
 * run whatever the mode. Check stages read what other stages wrote and
 * nothing depends on them, so leaving them out never changes what the rest
 * of the build does.
 *
 * @param {{
 *   stages: import("./build-data.mjs").Stage[],
 *   from?: string,
 *   only?: string,
 *   checksOnly?: boolean,
 *   verifyChecks?: boolean,
 *   env?: Record<string, string | undefined>,
 * }} options
 */
export function selectStages({
	stages,
	from,
	only,
	checksOnly = false,
	verifyChecks = false,
	env = process.env,
}) {
	const checks = checksOnly
		? { run: true, reason: "--checks" }
		: resolveChecks({ flag: verifyChecks, env });
	const isCheck = (stage) => stage.check === true;
	const skippedChecks = [];
	let selected = planBuild(
		stages,
		from,
		only === undefined ? undefined : [only],
	);
	if (checksOnly) selected = planBuild(stages).filter(isCheck);
	else if (!checks.run)
		selected = selected.filter((stage) => {
			if (!isCheck(stage) || stage.name === only) return true;
			skippedChecks.push(stage.name);
			return false;
		});
	return { selected, skippedChecks, checks, isCheck };
}
