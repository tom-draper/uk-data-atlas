import { isMainModule } from "../lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { buildGeometrySourceRegistry } from "../geographies/buildGeometrySourceRegistry.ts";

const path = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = buildGeometrySourceRegistry(
		resolve(dirname(path), "../../.."),
	);
	buildLog.info(
		`Wrote ${formatCount(result.count)} geometry sources to ${repoPath(result.path)}`,
	);
}
