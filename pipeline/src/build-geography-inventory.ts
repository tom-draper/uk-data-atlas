import { isMainModule } from "./lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, formatCount } from "@uk-data-atlas/atlas-db";
import { buildGeographyInventory } from "./geographies/buildGeographyInventory.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildGeographyInventory(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.sourceCount)} sources and ${formatCount(result.releaseCount)} geography releases`,
	);
}
