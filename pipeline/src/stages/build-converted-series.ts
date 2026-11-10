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
	const { summaries, output } = buildConvertedSeries(
		resolve(dirname(scriptPath), "../../.."),
		(summary, milliseconds) => {
			const gaps = Object.values(summary.gaps).reduce((a, b) => a + b, 0);
			buildLog.info(
				`${summary.entry.id}: ${formatCount(summary.series)} series, ${formatCount(summary.regrouped)} regrouped and ${formatCount(summary.estimated)} estimated values, ${formatCount(gaps)} gaps in ${formatDuration(milliseconds)}`,
			);
		},
	);
	buildLog.info(
		`Converted ${formatCount(summaries.reduce((sum, s) => sum + s.series, 0))} series in ${formatDuration(performance.now() - started)}, to ${repoPath(output)}`,
	);
}
