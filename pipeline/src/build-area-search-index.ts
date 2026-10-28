import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuckdbAreaSearchIndex } from "./build-duckdb-area-search-index";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = await buildDuckdbAreaSearchIndex(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(
		`Wrote ${result.areas} area identities under ${result.terms} terms to ${result.outputPath}`,
	);
}
