import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildLog,
	formatCount,
	formatDuration,
	repoPath,
} from "@uk-data-atlas/atlas-db";
import { buildConversionBacktest } from "../conversion/runConversionBacktest.ts";
import { isMainModule } from "../lib/entrypoint.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const started = performance.now();
	const { run, output } = buildConversionBacktest(
		resolve(dirname(scriptPath), "../../.."),
		(result, milliseconds) => {
			const exact = result.summaries.reduce((sum, s) => sum + s.exact, 0);
			buildLog.info(
				`${result.case.id} on ${result.basis}: ${
					result.skipped ??
					`${formatCount(exact)} of ${formatCount(result.compared)} exact`
				} in ${formatDuration(milliseconds)}`,
			);
		},
	);
	for (const c of run.classes)
		buildLog.info(
			`${c.method} on ${c.basis}: error up to ${c.factor} of the amount at risk, over ${formatCount(c.compared)} values`,
		);
	buildLog.info(
		`Backtested ${formatCount(run.results.length)} conversions in ${formatDuration(performance.now() - started)}, to ${repoPath(output)}`,
	);
}
