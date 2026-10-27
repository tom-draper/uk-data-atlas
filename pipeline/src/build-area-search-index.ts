import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAreaSearchIndex } from "../../shared/buildAreaSearchIndex";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildAreaSearchIndex(resolve(dirname(scriptPath), "../.."));
	console.log(
		`Wrote ${result.areas} area identities under ${result.terms} terms to ${result.outputPath}`,
	);
}
