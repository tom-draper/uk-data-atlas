import { isMainModule } from "./lib/entrypoint.ts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAreaAdapters } from "@uk-data-atlas/areas";
import { readAreaSourceAdapters } from "@uk-data-atlas/areas";
import { compileAreas } from "./geographies/areaInventory.ts";
import { createBoundaryRegistry } from "./build-boundary-registry.ts";
import {
	artifactDirectory,
	configDirectory,
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-db";

export const buildAreaInventory = (repositoryRoot: string) => {
	const outputDirectory = artifactDirectory(repositoryRoot);
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
				configDirectory(repositoryRoot),
				"area-property-adapters.json",
			),
		),
		readAreaSourceAdapters(
			join(configDirectory(repositoryRoot), "area-source-adapters.json"),
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
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildAreaInventory(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.artifactCount)} compiled area releases to ${repoPath(result.inventoryPath)}`,
	);
}
