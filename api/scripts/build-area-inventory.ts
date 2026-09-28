import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAreaAdapters } from "../src/areaAdapters";
import { readAreaSourceAdapters } from "../src/areaSourceAdapters";
import { compileAreas } from "../src/areaInventory";
import { createBoundaryRegistry } from "./build-boundary-registry";

export const buildAreaInventory = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const { artifacts, inventory } = compileAreas(
		repositoryRoot,
		createBoundaryRegistry(repositoryRoot),
		readAreaAdapters(
			join(
				repositoryRoot,
				"api",
				"config",
				"area-property-adapters.json",
			),
		),
		readAreaSourceAdapters(
			join(repositoryRoot, "api", "config", "area-source-adapters.json"),
		),
	);
	for (const artifact of artifacts) {
		const directory = join(outputDirectory, "areas", artifact.geography);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, `${artifact.boundaryRelease}.json`),
			`${JSON.stringify(artifact, null, "\t")}\n`,
		);
	}
	const inventoryPath = join(outputDirectory, "area-inventory.json");
	writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { inventoryPath, artifactCount: artifacts.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildAreaInventory(repositoryRoot);
	console.log(
		`Wrote ${result.artifactCount} compiled area releases to ${result.inventoryPath}`,
	);
}
