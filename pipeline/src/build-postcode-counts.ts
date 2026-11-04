import {
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuckdbPostcodeCounts } from "./postcode-counts/buildDuckdbPostcodeCounts.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = await buildDuckdbPostcodeCounts(
		resolve(dirname(scriptPath), "../.."),
	);
	buildLog.info(
		`Wrote postcode counts for ${formatCount(result.countedAreas)} area-release entries to ${repoPath(result.outputPath)}`,
	);
}
