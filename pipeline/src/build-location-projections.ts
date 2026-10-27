import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLocationProjections } from "../../shared/buildLocationProjections";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildLocationProjections(repositoryRoot);
	console.log(
		`Wrote ${result.count} location projections in ${result.shardCount} shards, and parents in ${result.parentShardCount} shards, to ${result.inventoryPath}`,
	);
}
