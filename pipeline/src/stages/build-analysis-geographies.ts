import { isMainModule } from "../lib/entrypoint.ts";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { buildAnalysisGeographies } from "../geographies/buildAnalysisGeographies.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = buildAnalysisGeographies(
		resolve(dirname(scriptPath), "../../.."),
	);
	buildLog.info(
		`Wrote ${formatCount(result.count)} analysis geography support entries to ${repoPath(result.outputPath)}`,
	);
}
