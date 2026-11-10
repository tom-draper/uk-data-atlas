import { isMainModule } from "../lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { buildOperations } from "../atlas/buildOperations.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const { outputPath, operationCount } = buildOperations(
		resolve(dirname(scriptPath), "../../.."),
	);
	buildLog.info(
		`Wrote ${formatCount(operationCount)} operation paths to ${repoPath(outputPath)}`,
	);
}
