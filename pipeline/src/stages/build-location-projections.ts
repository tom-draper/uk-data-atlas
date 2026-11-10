import { isMainModule } from "../lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLocationProjections } from "../places/buildLocationProjections.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildLocationProjections(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.count)} location projections in ${formatCount(result.shardCount)} shards, and parents in ${formatCount(result.parentShardCount)} shards, to ${repoPath(result.inventoryPath)}`,
	);
}
