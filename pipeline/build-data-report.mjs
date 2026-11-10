import { planWaves } from "./build-data-scheduler.mjs";
import {
	formatBytes,
	formatCount,
	formatDuration,
} from "../packages/atlas-db/src/buildTiming.ts";

export const plural = (count, noun) =>
	`${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;

export function formatAssetTree(files, { verbose = false } = {}) {
	const root = new Map();
	for (const [path, size] of files) {
		const parts = path.split("/");
		let node = root;
		for (const part of parts.slice(0, -1)) {
			if (!node.has(part)) node.set(part, new Map());
			node = node.get(part);
		}
		node.set(parts.at(-1), size);
	}
	const summarize = (node) => {
		let count = 0;
		let bytes = 0;
		let hasSqlite = false;
		for (const [name, value] of node) {
			if (value instanceof Map) {
				const child = summarize(value);
				count += child.count;
				bytes += child.bytes;
				hasSqlite ||= child.hasSqlite;
			} else {
				count += 1;
				bytes += value;
				hasSqlite ||= name.endsWith(".sqlite");
			}
		}
		return { count, bytes, hasSqlite };
	};
	const lines = [];
	const visit = (node, prefix) => {
		const entries = [...node].sort(([a], [b]) => a.localeCompare(b));
		entries.forEach(([name, value], index) => {
			const last = index === entries.length - 1;
			const branch = `${prefix}${last ? "└── " : "├── "}`;
			if (value instanceof Map) {
				const summary = summarize(value);
				if (!verbose && summary.count > 8 && !summary.hasSqlite) {
					lines.push(
						`${branch}${name}/ (${formatCount(summary.count)} files, ${formatBytes(summary.bytes)})`,
					);
				} else {
					lines.push(`${branch}${name}/`);
					visit(value, prefix + (last ? "    " : "│   "));
				}
			} else {
				lines.push(`${branch}${name} (${formatBytes(value)})`);
			}
		});
	};
	visit(root, "  ");
	return lines;
}

/**
 * Stage timings and the end-of-build summary. `recordTiming` notes one
 * stage; `reportSummary` writes the summary to the cache and logs the totals,
 * the slowest stages and the generated assets. A plan has no summary.
 *
 * @param {{
 *   cache: { writeBuildSummary: Function, generatedFiles?: () => [string, number][] } | null,
 *   log: (line: string) => void,
 *   plan: boolean,
 *   adopt: boolean,
 *   verbose: boolean,
 *   startedAt: number,
 *   buildStartedAt: string,
 * }} options
 */
export function createBuildReport({
	cache,
	log,
	plan,
	adopt,
	verbose,
	startedAt,
	buildStartedAt,
}) {
	const timings = [];
	const recordTiming = (
		name,
		stageStartedAt,
		command = 0,
		skipped = false,
	) => {
		const total = performance.now() - stageStartedAt;
		timings.push({
			name,
			total,
			command,
			overhead: total - command,
			skipped,
		});
		return total;
	};
	const reportSummary = (failed) => {
		if (plan) return;
		cache?.writeBuildSummary({
			startedAt: buildStartedAt,
			finishedAt: new Date().toISOString(),
			totalMs: performance.now() - startedAt,
			failed,
			stages: timings.map(
				({ name, total, command, skipped, failed }) => ({
					name,
					status: failed ? "failed" : skipped ? "skipped" : "ran",
					totalMs: total,
					commandMs: command,
				}),
			),
		});
		const ran = timings.filter((timing) => !timing.skipped);
		const unchanged = timings.length - ran.length;
		const failures = Math.max(
			1,
			timings.filter((timing) => timing.failed).length,
		);
		const elapsed = formatDuration(performance.now() - startedAt);
		log("");
		log(
			failed
				? `Data build failed after ${elapsed} (${formatCount(Math.max(0, ran.length - failures))} ran, ${formatCount(failures)} failed, ${formatCount(unchanged)} unchanged)`
				: `Data build done in ${elapsed} (${formatCount(ran.length)} ran, ${formatCount(unchanged)} unchanged)`,
		);
		const slowest = [...ran].sort((a, b) => b.total - a.total).slice(0, 5);
		if (slowest.length) {
			const width = Math.max(
				...slowest.map((timing) => timing.name.length),
			);
			log("Slowest stages:");
			for (const timing of slowest)
				log(
					`  ${timing.name.padEnd(width)}  ${formatDuration(timing.total)}${verbose ? ` (command ${formatDuration(timing.command)}, overhead ${formatDuration(timing.overhead)})` : ""}`,
				);
		}
		const generated =
			!failed && !adopt ? (cache?.generatedFiles?.() ?? []) : [];
		if (generated.length) {
			const generatedBytes = generated.reduce(
				(total, [, size]) => total + size,
				0,
			);
			log(
				`Generated assets (${plural(generated.length, "file")}, ${formatBytes(generatedBytes)} total):`,
			);
			for (const line of formatAssetTree(generated, { verbose }))
				log(line);
		}
	};
	return { timings, recordTiming, reportSummary };
}

/**
 * The opening lines: how many stages run, the parity check notes and the
 * job limit.
 *
 * @param {{
 *   log: (line: string) => void,
 *   adopt: boolean,
 *   plan: boolean,
 *   selected: { name: string }[],
 *   toRun: Set<string>,
 *   skippedChecks: string[],
 *   checks: { run: boolean, reason?: string },
 *   isCheck: (stage: any) => boolean,
 *   jobs: number,
 *   memoryMb: number,
 * }} options
 */
export function logBuildHeader({
	log,
	adopt,
	plan,
	selected,
	toRun,
	skippedChecks,
	checks,
	isCheck,
	jobs,
	memoryMb,
}) {
	log(
		adopt
			? `Data build: adopting existing outputs for ${plural(selected.length, "stage")}`
			: `Data build${plan ? " plan" : ""}: ${plural(selected.length, "stage")}, ${formatCount(toRun.size)} to run, ${formatCount(selected.length - toRun.size)} unchanged`,
	);
	if (skippedChecks.length)
		log(
			`Parity checks not run (${formatCount(skippedChecks.length)}): ${skippedChecks.join(", ")}. Run them with pnpm data:verify or pnpm data:build --verify.`,
		);
	else if (!adopt && checks.run && selected.some(isCheck))
		log(
			`Parity checks on (${checks.reason}); each reruns only when its inputs or code changed.`,
		);
	if (jobs > 1 && !adopt && !plan)
		log(
			`Running up to ${formatCount(jobs)} stages at once within ${formatCount(Math.round(memoryMb))} MB`,
		);
	log("");
}

/** Notes the stages that wrote outside their declarations or recorded a wrong hash. */
export function logRunProblems({ log, undeclaredStages, mismatchedStages }) {
	if (undeclaredStages.length)
		log(
			`Undeclared writes in ${plural(undeclaredStages.length, "stage")}: ${undeclaredStages.join(", ")}. Declare their writes in the stage definition.`,
		);
	if (mismatchedStages.length)
		log(
			`Wrong output hashes in ${plural(mismatchedStages.length, "stage")}: ${mismatchedStages.join(", ")}. Each recorded a hash its file does not have, so the build would have trusted it.`,
		);
}

/**
 * The end of a plan: the estimated time and the parallel schedule. Other
 * builds log nothing here.
 *
 * @param {{
 *   log: (line: string) => void,
 *   plan: boolean,
 *   adopt: boolean,
 *   selected: any[],
 *   toRun: Set<string>,
 *   jobs: number,
 *   memoryMb: number,
 *   estimated: number,
 *   knownEstimates: number,
 *   weightOf: (stage: any) => number,
 * }} options
 */
export function logPlanForecast({
	log,
	plan,
	adopt,
	selected,
	toRun,
	jobs,
	memoryMb,
	estimated,
	knownEstimates,
	weightOf,
}) {
	if (plan && knownEstimates)
		log(
			`Estimated total: ${formatDuration(estimated)} for ${knownEstimates} of ${toRun.size} stages to run`,
		);
	if (plan && !adopt && toRun.size > 0) {
		const schedule = planWaves(selected, { runs: toRun, weightOf });
		log("");
		log(
			`Parallel schedule (stages in a wave can run together; up to ${formatCount(jobs)} at once within ${formatCount(Math.round(memoryMb))} MB):`,
		);
		schedule.waves.forEach((names, index) =>
			log(`  ${index + 1}. ${names.join(", ")}`),
		);
		log(
			`Critical path: ${schedule.criticalPath.join(" > ")}${knownEstimates === toRun.size ? ` (${formatDuration(schedule.criticalMs)} of ${formatDuration(schedule.totalMs)} in all)` : ""}`,
		);
	}
}
