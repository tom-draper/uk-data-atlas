import { isMainModule } from "./lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { buildRelationshipPaths } from "./relationships/buildRelationshipPaths.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = buildRelationshipPaths(
		resolve(dirname(scriptPath), "../.."),
	);
	buildLog.info(
		`Wrote ${formatCount(result.count)} relationship paths to ${repoPath(result.outputPath)}`,
	);
}
