import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTerrainCatalogue } from "../src/terrainCatalogue";

export const buildTerrainCatalogue = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
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
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildTerrainCatalogue(repositoryRoot);
	console.log(
		`Wrote ${result.productCount} terrain products to ${result.cataloguePath}`,
	);
}
