import { isMainModule } from "../lib/entrypoint.ts";
import { parseScriptArgs } from "../lib/args.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { buildPostcodeAreas } from "../postcodes/buildPostcodeAreas.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainThread && isMainModule(import.meta.url)) {
	const flags = parseScriptArgs({
		rebuild: { type: "boolean" },
		workers: { type: "string" },
	}).values;
	const { outputPath, artifact } = await buildPostcodeAreas(
		resolve(dirname(scriptPath), "../../.."),
		{
			rebuild: flags.rebuild === true,
			...(flags.workers === undefined
				? {}
				: {
						workers: Number(
							typeof flags.workers === "string"
								? flags.workers
								: undefined,
						),
					}),
		},
	);
	buildLog.info(
		`Wrote the areas of every postcode in ${formatCount(artifact.releases.length)} releases, over ${formatCount(artifact.shards.length)} districts, to ${repoPath(outputPath)}`,
	);
}
