import {
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuckdbPlaceIndex } from "./buildDuckdbPlaceIndex";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = await buildDuckdbPlaceIndex(
		resolve(dirname(scriptPath), "../.."),
	);
	buildLog.info(
		`Wrote ${formatCount(result.places)} places under ${formatCount(result.names)} names to ${repoPath(result.outputPath)}`,
	);
}
