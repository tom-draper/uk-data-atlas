import { isMainModule } from "../lib/entrypoint.ts";
import { buildLog, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGeographyCatalogues } from "../geographies/buildGeographyCatalogues.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url))
	buildLog.info(
		`Stored geography catalogues in ${repoPath(buildGeographyCatalogues(resolve(dirname(scriptPath), "../../..")))}`,
	);
