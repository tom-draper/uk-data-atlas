import {
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAnalysisGeographyValidation } from "./buildAnalysisGeographyValidation";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildAnalysisGeographyValidation(
		resolve(dirname(scriptPath), "../.."),
	);
	buildLog.info(
		`Validated ${formatCount(result.count)} analysis geography support entries at ${repoPath(result.outputPath)}`,
	);
}
