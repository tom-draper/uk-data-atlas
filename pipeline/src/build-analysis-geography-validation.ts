import { isMainModule } from "./lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAnalysisGeographyValidation } from "./buildAnalysisGeographyValidation.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = buildAnalysisGeographyValidation(
		resolve(dirname(scriptPath), "../.."),
	);
	buildLog.info(
		`Validated ${formatCount(result.count)} analysis geography support entries at ${repoPath(result.outputPath)}`,
	);
}
