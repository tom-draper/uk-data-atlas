import {
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLocationProjections } from "./places/buildLocationProjections.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildLocationProjections(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.count)} location projections in ${formatCount(result.shardCount)} shards, and parents in ${formatCount(result.parentShardCount)} shards, to ${repoPath(result.inventoryPath)}`,
	);
}
