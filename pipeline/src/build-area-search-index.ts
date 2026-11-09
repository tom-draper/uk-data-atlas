import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuckdbAreaSearchIndex } from "./buildDuckdbAreaSearchIndex.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = await buildDuckdbAreaSearchIndex(
		resolve(dirname(scriptPath), "../.."),
	);
	buildLog.info(
		`Wrote ${formatCount(result.areas)} area identities under ${formatCount(result.terms)} terms to ${repoPath(result.outputPath)}`,
	);
}
