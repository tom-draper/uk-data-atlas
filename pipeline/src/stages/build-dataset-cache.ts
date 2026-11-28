import { buildLog, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "../lib/entrypoint.ts";
import { writeDatasetPayloads } from "../storage/datasetPayloadWriter.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const root = resolve(dirname(scriptPath), "../../..");
	const path = writeDatasetPayloads(
		root,
		join(root, "data/build/atlas-base.sqlite"),
	);
	buildLog.info(`Wrote dataset cache part to ${repoPath(path)}`);
}
