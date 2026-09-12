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
	const populationUkPath = join(
		repositoryRoot,
		"data",
		"precompiled",
		"population-uk.json",
	);
	const ghgEmissionsPath = join(
		repositoryRoot,
		"data",
		"precompiled",
		"ghg-emissions.json",
	);
	if (
		!existsSync(manifestPath) ||
		!existsSync(populationPath) ||
		!existsSync(populationUkPath) ||
		!existsSync(ghgEmissionsPath)
	) {
		throw new Error(
			"Build the dataset manifest, ward population, UK local-authority population and greenhouse gas emissions data before the API data catalogue.",
		);
	}
	const outputDirectory = join(repositoryRoot, "api", "public");
	const {
		catalog,
		populationObservations,
		populationLocalAuthorityObservations,
		ghgEmissionsObservations,
	} = compileDataCatalog(
		manifestPath,
		populationPath,
		populationUkPath,
		ghgEmissionsPath,
	);
	const catalogPath = join(outputDirectory, "data-catalog.json");
	const observationsPath = join(
		outputDirectory,
		"population-observations.json",
	);
	const localAuthorityObservationsPath = join(
		outputDirectory,
		"population-local-authority-observations.json",
	);
	const ghgEmissionsObservationsPath = join(
		outputDirectory,
		"ghg-emissions-observations.json",
	);
	writeFileSync(catalogPath, `${JSON.stringify(catalog, null, "\t")}\n`);
	writeFileSync(
		ghgEmissionsObservationsPath,
		`${JSON.stringify(ghgEmissionsObservations, null, "\t")}\n`,
	);
	writeFileSync(
		observationsPath,
		`${JSON.stringify(populationObservations, null, "\t")}\n`,
	);
	writeFileSync(
		localAuthorityObservationsPath,
		`${JSON.stringify(populationLocalAuthorityObservations, null, "\t")}\n`,
	);
	return {
		catalogPath,
		observationsPath,
		localAuthorityObservationsPath,
		ghgEmissionsObservationsPath,
		emissionsRecordCount: ghgEmissionsObservations.periods.reduce(
			(count, period) => count + period.records.length,
			0,
		),
		wardRecordCount: populationObservations.records.length,
		localAuthorityRecordCount:
			populationLocalAuthorityObservations.periods.reduce(
				(count, period) => count + period.records.length,
				0,
			),
	};
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildDataCatalog(repositoryRoot);
	console.log(
		`Wrote data catalogue, ${result.wardRecordCount} ward observations, ${result.localAuthorityRecordCount} local-authority observations and ${result.emissionsRecordCount} emissions observations to ${result.catalogPath}`,
	);
}
