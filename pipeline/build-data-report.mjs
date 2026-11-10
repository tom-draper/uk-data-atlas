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
