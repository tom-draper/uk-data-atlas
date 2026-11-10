import { isMainModule } from "./lib/entrypoint.ts";
import { parseScriptArgs } from "./lib/args.ts";
import {
	buildLog,
	formatCount,
	formatDuration,
	repoPath,
} from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { buildWeightAtomsStage } from "./crosswalk-weights/buildWeightAtoms.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainThread && isMainModule(import.meta.url)) {
	const result = await buildWeightAtomsStage(
		resolve(dirname(scriptPath), "../.."),
		{
			rebuild:
				parseScriptArgs({ rebuild: { type: "boolean" } }).values
					.rebuild === true,
		},
	);
	buildLog.info(
		`Placed ${formatCount(result.atoms.count)} atoms in ${formatCount(result.releases)} releases in ${formatDuration(result.seconds * 1000)}, to ${repoPath(result.directory)}`,
	);
}
