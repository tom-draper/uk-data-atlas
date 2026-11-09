import { buildLog, formatCount } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDatasetPayloads } from "./checks/verifyDatasetPayloads.ts";
import { writeStageStamp } from "./storage/stageStamp.ts";

/**
 * The `verify-dataset-payloads` check stage: the datasets served from
 * statistics rows regenerate to the values the compiler wrote.
 */
const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const root = resolve(dirname(scriptPath), "../..");
	const checked = verifyDatasetPayloads(root);
	writeStageStamp(root, "verify-dataset-payloads", {
		datasets: String(checked),
	});
	buildLog.info(
		`${formatCount(checked)} dataset payloads from statistics rows match their compiled values`,
	);
}
