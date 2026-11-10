import { isMainModule } from "../lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { buildTerrainCatalogue } from "../catalog/buildTerrainCatalogue.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildTerrainCatalogue(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.productCount)} terrain products to ${repoPath(result.cataloguePath)}`,
	);
}
