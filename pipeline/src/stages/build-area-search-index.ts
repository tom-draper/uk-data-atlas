import { isMainModule } from "../lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuckdbAreaSearchIndex } from "../places/buildDuckdbAreaSearchIndex.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = await buildDuckdbAreaSearchIndex(
		resolve(dirname(scriptPath), "../../.."),
	);
	buildLog.info(
		`Wrote ${formatCount(result.areas)} area identities under ${formatCount(result.terms)} terms to ${repoPath(result.outputPath)}`,
	);
}
