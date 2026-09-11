import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBoundaryRegistry } from "./build-boundary-registry";
import { createGeographyInventory } from "../src/geographyInventory";
import { createSourceInventory } from "../src/sourceInventory";
import type { AreaInventory } from "../src/areaInventory";

export const buildGeographyInventory = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const sourceInventory = createSourceInventory(repositoryRoot);
	const areaInventoryPath = join(outputDirectory, "area-inventory.json");
	const areaInventory = existsSync(areaInventoryPath)
		? (JSON.parse(readFileSync(areaInventoryPath, "utf8")) as AreaInventory)
		: undefined;
	const geographyInventory = createGeographyInventory(
		createBoundaryRegistry(repositoryRoot),
		sourceInventory,
		areaInventory,
	);
	const sourcePath = join(outputDirectory, "source-inventory.json");
	const geographyPath = join(outputDirectory, "geography-inventory.json");
	writeFileSync(
		sourcePath,
		`${JSON.stringify(sourceInventory, null, "\t")}\n`,
	);
	writeFileSync(
		geographyPath,
		`${JSON.stringify(geographyInventory, null, "\t")}\n`,
	);
	return {
		sourcePath,
		geographyPath,
		sourceCount: sourceInventory.sources.length,
		releaseCount: geographyInventory.releases.length,
	};
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildGeographyInventory(repositoryRoot);
	console.log(
		`Wrote ${result.sourceCount} sources and ${result.releaseCount} geography releases`,
	);
}
