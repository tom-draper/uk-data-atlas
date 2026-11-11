import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildLog,
	formatCount,
	formatDuration,
	repoPath,
} from "@uk-data-atlas/atlas-db";
import { buildConvertedSeries } from "../conversion/runConvertedSeries.ts";
import { isMainModule } from "../lib/entrypoint.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const started = performance.now();
	const { summaries, skips, output } = buildConvertedSeries(
		resolve(dirname(scriptPath), "../../.."),
		(summary, milliseconds) => {
			const gaps = Object.values(summary.gaps).reduce((a, b) => a + b, 0);
			buildLog.info(
				`${summary.entry.id}: ${formatCount(summary.series)} series, ${formatCount(summary.regrouped)} regrouped and ${formatCount(summary.estimated)} estimated values, ${formatCount(gaps)} gaps in ${formatDuration(milliseconds)}`,
			);
		},
	);
	const left = new Map<string, number>();
	for (const skip of skips)
		left.set(skip.reason, (left.get(skip.reason) ?? 0) + skip.series);
	for (const [reason, series] of left)
		buildLog.info(`Left out as ${reason}: ${formatCount(series)} series`);
	buildLog.info(
		`Converted ${formatCount(summaries.reduce((sum, s) => sum + s.series, 0))} series in ${formatDuration(performance.now() - started)}, to ${repoPath(output)}`,
	);
}
