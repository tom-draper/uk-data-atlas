import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTerrainCatalogue } from "./terrainCatalogue.ts";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";

export const buildTerrainCatalogue = (repositoryRoot: string) => {
	const outputDirectory = artifactDirectory(repositoryRoot);
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const catalogue = createTerrainCatalogue();
	const cataloguePath = join(outputDirectory, "terrain-catalogue.json");
	writeFileSync(cataloguePath, `${JSON.stringify(catalogue, null, "\t")}\n`);
	return { cataloguePath, productCount: catalogue.products.length };
};
