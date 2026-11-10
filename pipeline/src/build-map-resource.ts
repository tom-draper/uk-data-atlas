import { isMainModule } from "./lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMapResources } from "./maps/buildMapResource.ts";

const path = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = buildMapResources(resolve(dirname(path), "../.."), (line) =>
		buildLog.detail(line),
	);
	buildLog.info(
		`Wrote ${formatCount(result.resources.length)} map resources to ${repoPath(result.path)}` +
			(result.unavailable.length
				? `, ${formatCount(result.unavailable.length)} releases could not be tiled`
				: ""),
	);
}
