import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileDataCatalog } from "../src/dataCatalog";

export const buildDataCatalog = (repositoryRoot: string) => {
	const manifestPath = join(
		repositoryRoot,
		"data",
		"precompiled",
		"dataset-manifest.json",
	);
	const populationPath = join(
		repositoryRoot,
		"data",
		"precompiled",
		"population.json",
	);
	if (!existsSync(manifestPath) || !existsSync(populationPath)) {
		throw new Error(
			"Build the dataset manifest and ward population data before the API data catalogue.",
		);
	}
	const outputDirectory = join(repositoryRoot, "api", "public");
	const { catalog, populationObservations } = compileDataCatalog(
		manifestPath,
		populationPath,
	);
	const catalogPath = join(outputDirectory, "data-catalog.json");
	const observationsPath = join(
		outputDirectory,
		"population-observations.json",
	);
	writeFileSync(catalogPath, `${JSON.stringify(catalog, null, "\t")}\n`);
	writeFileSync(
		observationsPath,
		`${JSON.stringify(populationObservations, null, "\t")}\n`,
	);
	return {
		catalogPath,
		observationsPath,
		recordCount: populationObservations.records.length,
	};
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildDataCatalog(repositoryRoot);
	console.log(
		`Wrote data catalogue and ${result.recordCount} population observations to ${result.catalogPath}`,
	);
}
