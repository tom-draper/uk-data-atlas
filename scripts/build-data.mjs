import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStageCache } from "./build-data-cache.mjs";
import { buildDataStages } from "./build-data-graph.mjs";

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
		throw new Error(`Stage ${from} is not part of the selected build.`);
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
 * @typedef {{ name: string, dependencies: string[], args: string[], cacheable?: boolean, outputs?: string[], requiredOutputs?: string[], codeInputs?: string[] }} Stage
 * @param {{
 *   argv?: string[],
 *   stages?: Stage[],
 *   execute?: (stage: Stage) => number,
 *   log?: (line: string) => void,
 *   createCache?: () => ReturnType<typeof createStageCache> | null,
 * }} [options]
 */
export function runBuild({
	argv = [],
	stages = buildDataStages,
	execute = executeStage,
	log = console.log,
	createCache = () => null,
} = {}) {
	let from;
	let only;
	let plan = false;
	let adopt = false;
	let useCache = true;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--adopt" && !adopt) {
			adopt = true;
		} else if (argument === "--plan" && !plan) {
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
		} else {
			throw new Error(
				`Unknown or repeated argument: ${argument}. Usage: pnpm data:build [--only <stage> | --from <stage>] [--plan] [--no-cache | --adopt]`,
			);
		}
	}
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
	const selected = planBuild(
		stages,
		from,
		only === undefined ? undefined : [only],
	);
	const startedAt = performance.now();
	const timings = [];
	const recordTiming = (name, startedAt, command = 0, skipped = false) => {
		const total = performance.now() - startedAt;
		timings.push({
			name,
			total,
			command,
			overhead: total - command,
			skipped,
		});
	};
	const reportTimings = () => {
		if (plan) return;
		log(
			`Data build took ${((performance.now() - startedAt) / 1000).toFixed(1)}s.`,
		);
		for (const timing of [...timings]
			.sort((a, b) => b.total - a.total)
			.slice(0, 5))
			log(
				`  ${timing.name}: ${(timing.total / 1000).toFixed(1)}s total, ${(timing.command / 1000).toFixed(1)}s command, ${(timing.overhead / 1000).toFixed(1)}s overhead${timing.skipped ? " (skipped)" : ""}`,
			);
	};
	const cache = createCache();
	if (adopt) {
		if (!cache) throw new Error("--adopt requires a stage cache.");
		cache.validateAdoption(
			selected.filter((stage) => stage.cacheable !== false),
		);
	}
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
		const stageStartedAt = performance.now();
		const description = `${stage.name}: pnpm ${stage.args.join(" ")} [depends on: ${stage.dependencies.join(", ") || "none"}]`;
		const dependencies = dependencyDigests(stage);
		if (adopt) {
			if (stage.cacheable === false) {
				log(`${stage.name}: not cacheable, skipped`);
				continue;
			}
			if (plan) {
				log(`${stage.name}: would adopt existing outputs`);
				continue;
			}
			const adopted = cache.adopt(stage, dependencies);
			digests.set(stage.name, adopted.digest);
			log(`${stage.name}: adopted ${adopted.files.length} output files`);
			for (const path of adopted.files) log(`  ${path}`);
			continue;
		}
		const reused =
			reuse && stage.cacheable !== false && !dependencies.includes(null)
				? cache.lookup(stage, dependencies)
				: null;
		if (reused !== null) {
			log(`${description} (unchanged, skipped)`);
			digests.set(stage.name, reused);
			recordTiming(stage.name, stageStartedAt, 0, true);
			continue;
		}
		log(description);
		if (plan) {
			if (stage.cacheable !== false) digests.set(stage.name, null);
			continue;
		}
		cache?.begin(stage.name);
		const commandStartedAt = performance.now();
		const status = execute(stage);
		const command = performance.now() - commandStartedAt;
		if (status !== 0) {
			log(
				`Stage ${stage.name} failed with exit code ${status}. Build stopped.`,
			);
			recordTiming(stage.name, stageStartedAt, command);
			reportTimings();
			return status;
		}
		const digest = cache?.record(stage, dependencies, {
			cacheable: stage.cacheable !== false,
		});
		if (stage.cacheable !== false) digests.set(stage.name, digest ?? null);
		recordTiming(stage.name, stageStartedAt, command);
	}
	reportTimings();
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
