import { isMainModule } from "../lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuckdbPostcodeCounts } from "../postcode-counts/buildDuckdbPostcodeCounts.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = await buildDuckdbPostcodeCounts(
		resolve(dirname(scriptPath), "../../.."),
	);
	buildLog.info(
		`Wrote postcode counts for ${formatCount(result.countedAreas)} area-release entries to ${repoPath(result.outputPath)}`,
	);
}
