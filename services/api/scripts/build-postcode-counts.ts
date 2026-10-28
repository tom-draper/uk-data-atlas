import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPostcodeCounts } from "../src/cache-build/buildPostcodeCounts";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildPostcodeCounts(
		resolve(dirname(scriptPath), "../../.."),
	);
	console.log(
		`Wrote postcode counts for ${result.countedAreas} area-release entries to ${result.outputPath}`,
	);
}
