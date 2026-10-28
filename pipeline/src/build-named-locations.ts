import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNamedLocations } from "./buildNamedLocations";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildNamedLocations(repositoryRoot);
	console.log(
		`Wrote ${result.count} named locations to ${result.outputPath}`,
	);
}
