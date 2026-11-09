import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNamedLocations } from "./places/buildNamedLocations.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildNamedLocations(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.count)} named locations to ${repoPath(result.outputPath)}`,
	);
}
