// A stage that always runs reaches later stages through their inputs.
export const ALWAYS_RUNS = "always-runs";

/**
 * The always-running stages that report their work is already done, so the
 * build skips them without a command.
 */
export async function findCurrentStages(selected) {
	const current = new Set();
	for (const stage of selected)
		if (stage.cacheable === false && (await stage.isCurrent?.()))
			current.add(stage.name);
	return current;
}

/**
 * Tracks each stage's output digest this build, or null once a stage has to
 * run (in a plan, its outputs are not known until it does), and looks up
 * which stages the cache lets the build skip.
 *
 * @param {{
 *   stages: { name: string, dependencies: string[], cacheable?: boolean }[],
 *   selected: { name: string, dependencies: string[], cacheable?: boolean }[],
 *   cache: { outputDigest: Function, lookup: Function } | null,
 *   reuse: boolean,
 *   current: Set<string>,
 * }} options
 */
export function createDigestTracker({
	stages,
	selected,
	cache,
	reuse,
	current,
}) {
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
	return { digests, dependencyDigests, reusableDigest, stagesToRun };
}
