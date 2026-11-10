import { isMainModule } from "../lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBoundaryRegistry } from "../geographies/buildBoundaryRegistry.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const { outputPath, releaseCount } = buildBoundaryRegistry(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(releaseCount)} releases to ${repoPath(outputPath)}`,
	);
}
