import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuckdbPlaceIndex } from "./build-duckdb-place-index";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = await buildDuckdbPlaceIndex(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(
		`Wrote ${result.places} places under ${result.names} names to ${result.outputPath}`,
	);
}
