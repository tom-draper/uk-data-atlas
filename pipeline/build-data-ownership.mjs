import { stageScope } from "./build-data-cache.mjs";

const overlaps = (a, b) =>
	a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/** @typedef {{ name: string, cacheable?: boolean, writes?: string[], outputs?: string[], requiredOutputs?: string[], dependencies?: string[], dependencyOutputs?: Record<string, string[]> }} StageOwnership */

/**
 * A stage owns the paths it declares, and no other stage may declare a path
 * inside them. The one stage that owns none is a download that is never
 * cached (`sources`), which rewrites `data/source` and nothing the build
 * outputs hold.
 *
 * Returns what breaks that rule, one line per problem.
 *
 * @param {StageOwnership[]} stages
 */
export function ownershipProblems(stages) {
	const problems = [];
	const scoped = [];
	const byName = new Map(stages.map((stage) => [stage.name, stage]));
	for (const stage of stages) {
		const scope = stageScope(stage);
		if (scope) scoped.push({ name: stage.name, scope });
		else if (stage.cacheable !== false)
			problems.push(
				`${stage.name} declares no paths. Every stage must declare the files and folders it writes.`,
			);
		for (const [name, paths] of Object.entries(
			stage.dependencyOutputs ?? {},
		)) {
			const producer = byName.get(name);
			if (
				!stage.dependencies?.includes(name) ||
				!producer ||
				producer.cacheable === false
			) {
				problems.push(
					`${stage.name} scopes ${name}, which must be a direct, cacheable dependency.`,
				);
				continue;
			}
			if (paths.length === 0)
				problems.push(
					`${stage.name} scopes ${name} without listing any output files.`,
				);
			const owned = stageScope(producer) ?? [];
			for (const path of paths)
				if (
					!owned.some(
						(owner) =>
							path === owner || path.startsWith(`${owner}/`),
					)
				)
					problems.push(
						`${stage.name} scopes ${name} to ${path}, which ${name} does not own.`,
					);
		}
	}
	for (const [index, first] of scoped.entries())
		for (const second of scoped.slice(index + 1))
			for (const path of first.scope)
				for (const other of second.scope)
					if (overlaps(path, other))
						problems.push(
							`${first.name} and ${second.name} both write ${path === other ? path : `${path} and ${other}`}. A path has one owning stage.`,
						);
	return [...new Set(problems)];
}

/**
 * Throws unless every path in the graph has one owning stage, and returns the
 * stages as they were given.
 *
 * @template {StageOwnership} T
 * @param {T[]} stages
 * @returns {T[]}
 */
export function assertStageOwnership(stages) {
	const problems = ownershipProblems(stages);
	if (problems.length)
		throw new Error(
			`The build graph breaks stage ownership:\n${problems.map((line) => `  ${line}`).join("\n")}`,
		);
	return stages;
}
