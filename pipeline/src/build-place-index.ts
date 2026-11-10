import { isMainModule } from "./lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuckdbPlaceIndex } from "./buildDuckdbPlaceIndex.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = await buildDuckdbPlaceIndex(
		resolve(dirname(scriptPath), "../.."),
	);
	buildLog.info(
		`Wrote ${formatCount(result.places)} places under ${formatCount(result.names)} names to ${repoPath(result.outputPath)}`,
	);
}
