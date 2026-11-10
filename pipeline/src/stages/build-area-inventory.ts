import { isMainModule } from "../lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { buildAreaInventory } from "../geographies/buildAreaInventory.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildAreaInventory(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.artifactCount)} compiled area releases to ${repoPath(result.inventoryPath)}`,
	);
}
