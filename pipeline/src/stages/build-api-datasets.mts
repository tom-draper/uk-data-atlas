import { isMainModule } from "../lib/entrypoint.ts";
import { resolve } from "node:path";
import { buildLog, repoPath } from "@uk-data-atlas/atlas-db";
import { buildDatasets } from "../precompile/buildApiDatasets.ts";

if (isMainModule(import.meta.url)) {
	const result = await buildDatasets(
		resolve(import.meta.dirname, "../../.."),
	);
	buildLog.info(
		`Wrote boundary assets and gazetteer core to ${repoPath(result.directory)}`,
	);
}
