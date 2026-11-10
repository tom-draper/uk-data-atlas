import { isMainModule } from "./lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { buildLookupManifest } from "./atlas/buildLookupManifest.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = buildLookupManifest(resolve(dirname(scriptPath), "../.."));
	buildLog.info(
		`Wrote ${formatCount(result.lookupCount)} bulk lookups to ${repoPath(result.outputPath)}`,
	);
}
