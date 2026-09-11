import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCrosswalkAdapters } from "../src/crosswalkAdapters";
import { compileCrosswalks } from "../src/crosswalkInventory";

export const buildCrosswalkInventory = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const { inventory, artifacts } = compileCrosswalks(
		repositoryRoot,
		readCrosswalkAdapters(
			join(repositoryRoot, "api", "config", "crosswalk-adapters.json"),
		),
	);
	for (const artifact of artifacts) {
		const path = join(outputDirectory, "crosswalks", `${artifact.id}.json`);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${JSON.stringify(artifact, null, "\t")}\n`);
	}
	const inventoryPath = join(outputDirectory, "crosswalk-inventory.json");
	writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { inventoryPath, crosswalkCount: artifacts.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildCrosswalkInventory(repositoryRoot);
	console.log(
		`Wrote ${result.crosswalkCount} crosswalk to ${result.inventoryPath}`,
	);
}
