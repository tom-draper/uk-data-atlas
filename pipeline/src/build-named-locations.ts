import { isMainModule } from "./lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNamedLocations } from "./places/buildNamedLocations.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildNamedLocations(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.count)} named locations to ${repoPath(result.outputPath)}`,
	);
}
