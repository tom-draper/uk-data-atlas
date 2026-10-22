import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

export function runBuild({
	argv = [],
	stages = buildDataStages,
	targets = buildDataTargets,
	execute = executeStage,
	log = console.log,
} = {}) {
	let from;
	let target;
	let plan = false;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--plan" && !plan) {
			plan = true;
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
				`Unknown or repeated argument: ${argument}. Usage: build-data [--target <name>] [--from <stage>] [--plan]`,
			);
		}
	}
	const selected = planBuild(
		stages,
		from,
		target === undefined || target === "all" ? undefined : targets[target],
	);
	for (const stage of selected) {
		log(
			`${stage.name}: pnpm ${stage.args.join(" ")} [depends on: ${stage.dependencies.join(", ") || "none"}]`,
		);
		if (plan) continue;
		const status = execute(stage);
		if (status !== 0) {
			log(
				`Stage ${stage.name} failed with exit code ${status}. Build stopped.`,
			);
			return status;
		}
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
		process.exitCode = runBuild({ argv: process.argv.slice(2) });
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
