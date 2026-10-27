export { buildCrosswalkInventory } from "../../../shared/buildCrosswalkInventory";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCrosswalkInventory } from "../../../shared/buildCrosswalkInventory";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = await buildCrosswalkInventory(repositoryRoot);
	console.log(
		`Wrote ${result.crosswalkCount} crosswalks to ${result.inventoryPath}`,
	);
}
