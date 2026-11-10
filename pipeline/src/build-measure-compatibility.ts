import { isMainModule } from "./lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMeasureCompatibility } from "./statistics/buildMeasureCompatibility.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildMeasureCompatibility(repositoryRoot);
	console.log(
		`Wrote compatibility for ${result.measureCount} measures to ${result.outputPath}`,
	);
}
