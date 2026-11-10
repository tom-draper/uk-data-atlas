import { buildArtifactPath } from "@uk-data-atlas/areas";
import { mkdirSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createBoundaryRegistry } from "./buildBoundaryRegistry.ts";
import { createGeographyInventory } from "./geographyInventory.ts";
import { createSourceInventory } from "./sourceInventory.ts";
import type { AreaInventory } from "@uk-data-atlas/areas";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { readJsonSync } from "../lib/json.ts";

export const buildGeographyInventory = (repositoryRoot: string) => {
	const outputDirectory = artifactDirectory(repositoryRoot);
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const sourceInventory = createSourceInventory(repositoryRoot);
	const areaInventoryPath = join(outputDirectory, "area-inventory.json");
	const areaInventory = existsSync(areaInventoryPath)
		? (readJsonSync(areaInventoryPath) as AreaInventory)
		: undefined;
	const crosswalkInventoryPath = join(
		outputDirectory,
		"crosswalk-inventory.json",
	);
	const crosswalkInventory = existsSync(crosswalkInventoryPath)
		? (readJsonSync(crosswalkInventoryPath) as CrosswalkInventory)
		: undefined;
	const geographyInventory = createGeographyInventory(
		createBoundaryRegistry(repositoryRoot),
		sourceInventory,
		areaInventory,
		crosswalkInventory,
	);
	const geographyPath = buildArtifactPath(
		repositoryRoot,
		"geography-inventory.json",
	);
	mkdirSync(dirname(geographyPath), { recursive: true });
	writeFileSync(
		geographyPath,
		`${JSON.stringify(geographyInventory, null, "\t")}\n`,
	);
	rmSync(join(outputDirectory, "source-inventory.json"), { force: true });
	return {
		geographyPath,
		sourceCount: sourceInventory.sources.length,
		releaseCount: geographyInventory.releases.length,
	};
};
