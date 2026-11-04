import {
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCrosswalkInventory } from "./relationships/buildCrosswalkInventory.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = await buildCrosswalkInventory(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.crosswalkCount)} crosswalks to ${repoPath(result.inventoryPath)}`,
	);
}
