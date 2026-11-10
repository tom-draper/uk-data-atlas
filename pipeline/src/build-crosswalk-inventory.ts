import { isMainModule } from "./lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCrosswalkInventory } from "./relationships/buildCrosswalkInventory.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = await buildCrosswalkInventory(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.crosswalkCount)} crosswalks to ${repoPath(result.inventoryPath)}`,
	);
}
