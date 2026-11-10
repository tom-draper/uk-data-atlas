import { isMainModule } from "./lib/entrypoint.ts";
import { parseScriptArgs } from "./lib/args.ts";
import {
	buildLog,
	formatCount,
	formatDuration,
	repoPath,
} from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { MEASURES } from "./crosswalk-weights/atoms.ts";
import { buildCrosswalkWeights } from "./crosswalk-weights/buildCrosswalkWeights.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainThread && isMainModule(import.meta.url)) {
	const { output, summary, skipped, atoms, seconds } =
		await buildCrosswalkWeights(resolve(dirname(scriptPath), "../.."), {
			rebuild:
				parseScriptArgs({ rebuild: { type: "boolean" } }).values
					.rebuild === true,
		});
	for (const measure of MEASURES)
		buildLog.info(
			`${measure}: ${formatCount(Math.round(atoms.totals[measure].allocated))} of ${formatCount(Math.round(atoms.totals[measure].held))} held reached an atom`,
		);
	if (skipped.length > 0)
		buildLog.info(
			`No geometry for ${formatCount(skipped.length)} crosswalks`,
		);
	buildLog.info(
		`Weighted ${formatCount(summary.filter((entry) => Object.keys(entry.weighted).length > 0).length)} crosswalks in ${formatDuration(seconds * 1000)}, to ${repoPath(output)}`,
	);
}
