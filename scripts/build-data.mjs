import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStageCache } from "./build-data-cache.mjs";
import { buildDataStages, buildDataTargets } from "./build-data-graph.mjs";

const apiDirectory = fileURLToPath(
	new URL("../services/api/", import.meta.url),
);

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
		throw new Error(`Stage ${from} is not part of the selected target.`);
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

/**
 * @typedef {{ name: string, dependencies: string[], args: string[], cacheable?: boolean, outputs?: string[], requiredOutputs?: string[] }} Stage
 * @param {{
 *   argv?: string[],
 *   stages?: Stage[],
 *   targets?: Record<string, string[]>,
 *   execute?: (stage: Stage) => number,
 *   log?: (line: string) => void,
 *   createCache?: () => ReturnType<typeof createStageCache> | null,
 * }} [options]
 */
export function runBuild({
	argv = [],
	stages = buildDataStages,
	targets = buildDataTargets,
	execute = executeStage,
	log = console.log,
	createCache = () => null,
} = {}) {
	let from;
	let only;
	let target;
	let plan = false;
	let useCache = true;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--plan" && !plan) {
			plan = true;
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
		} else if (argument === "--target" && target === undefined) {
			target = argv[index + 1];
			if (!target || target.startsWith("--"))
				throw new Error("--target requires a target name.");
			if (target !== "all" && !Object.hasOwn(targets, target))
				throw new Error(
					`Unknown target: ${target}. Available targets: all, ${Object.keys(targets).join(", ")}`,
				);
			index += 1;
		} else {
			throw new Error(
				`Unknown or repeated argument: ${argument}. Usage: pnpm data:build [--target <name>] [--only <stage> | --from <stage>] [--plan] [--no-cache]`,
			);
		}
	}
	if (only !== undefined && from !== undefined)
		throw new Error("--only and --from cannot be combined.");
	const targetStages = planBuild(
		stages,
		undefined,
		target === undefined || target === "all" ? undefined : targets[target],
	);
	const selectedStage = only ?? from;
	if (
		selectedStage !== undefined &&
		!targetStages.some((stage) => stage.name === selectedStage)
	)
		throw new Error(
			stages.some((stage) => stage.name === selectedStage)
				? `Stage ${selectedStage} is not part of the selected target.`
				: `Unknown stage: ${selectedStage}. Available stages: ${stages.map((stage) => stage.name).join(", ")}`,
		);
	const selected = planBuild(
		targetStages,
		from,
		only === undefined ? undefined : [only],
	);
	const cache = createCache();
	// --from and --no-cache rerun every stage they select, and record them.
	const reuse = cache !== null && useCache && from === undefined;
	// Each stage's output digest this build, or null once a stage has to run
	// (in a plan, its outputs are not known until it does).
	const digests = new Map(
		stages
			.filter((stage) => stage.cacheable === false)
			.map((stage) => [stage.name, ALWAYS_RUNS]),
	);
	const dependencyDigests = (stage) =>
		stage.dependencies.map((name) =>
			digests.has(name)
				? digests.get(name)
				: (cache?.outputDigest(name) ?? null),
		);
	for (const stage of selected) {
		const description = `${stage.name}: pnpm ${stage.args.join(" ")} [depends on: ${stage.dependencies.join(", ") || "none"}]`;
		const dependencies = dependencyDigests(stage);
		const reused =
			reuse && stage.cacheable !== false && !dependencies.includes(null)
				? cache.lookup(stage, dependencies)
				: null;
		if (reused !== null) {
			log(`${description} (unchanged, skipped)`);
			digests.set(stage.name, reused);
			continue;
		}
		log(description);
		if (plan) {
			if (stage.cacheable !== false) digests.set(stage.name, null);
			continue;
		}
		cache?.begin(stage.name);
		const status = execute(stage);
		if (status !== 0) {
			log(
				`Stage ${stage.name} failed with exit code ${status}. Build stopped.`,
			);
			return status;
		}
		const digest = cache?.record(stage, dependencies, {
			cacheable: stage.cacheable !== false,
		});
		if (stage.cacheable !== false) digests.set(stage.name, digest ?? null);
	}
	return 0;
}

function executeStage(stage) {
	const result = spawnSync("pnpm", stage.args, {
		cwd: apiDirectory,
		stdio: "inherit",
	});
	if (result.error)
		throw new Error(
			`Cannot start stage ${stage.name}: ${result.error.message}`,
		);
	if (result.signal)
		throw new Error(
			`Stage ${stage.name} terminated by ${result.signal}. Build stopped.`,
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
		console.error(error.message);
		process.exitCode = 1;
	}
}
