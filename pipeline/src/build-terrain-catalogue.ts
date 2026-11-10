import { isMainModule } from "./lib/entrypoint.ts";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTerrainCatalogue } from "./terrainCatalogue.ts";
import {
	artifactDirectory,
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-db";

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

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildTerrainCatalogue(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.productCount)} terrain products to ${repoPath(result.cataloguePath)}`,
	);
}
