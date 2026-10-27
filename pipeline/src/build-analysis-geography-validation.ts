import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAnalysisGeographyValidation } from "../../shared/buildAnalysisGeographyValidation";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildAnalysisGeographyValidation(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(
		`Validated ${result.count} analysis geography support entries at ${result.outputPath}`,
	);
}
