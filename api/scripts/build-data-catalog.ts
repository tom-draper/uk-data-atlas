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
	const mobileCoveragePath = join(
		repositoryRoot,
		"data",
		"precompiled",
		"mobile-coverage.json",
	);
	const censusPaths = {
		"travel-to-work": join(
			repositoryRoot,
			"data",
			"precompiled",
			"travel-to-work.json",
		),
		"car-availability": join(
			repositoryRoot,
			"data",
			"precompiled",
			"car-availability.json",
		),
	};
	if (
		!existsSync(manifestPath) ||
		!existsSync(populationPath) ||
		!existsSync(populationUkPath) ||
		!existsSync(ghgEmissionsPath) ||
		!existsSync(mobileCoveragePath) ||
		Object.values(censusPaths).some((path) => !existsSync(path))
	) {
		throw new Error(
			"Build the dataset manifest, ward population, UK local-authority population, greenhouse gas emissions, mobile coverage and census transport data before the API data catalogue.",
		);
	}
	const outputDirectory = join(repositoryRoot, "api", "public");
	const {
		catalog,
		populationObservations,
		populationLocalAuthorityObservations,
		ghgEmissionsObservations,
		mobileCoverageObservations,
		censusObservations,
	} = compileDataCatalog(
		manifestPath,
		populationPath,
		populationUkPath,
		ghgEmissionsPath,
		mobileCoveragePath,
		censusPaths,
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
	const measureObservationPaths = [
		...mobileCoverageObservations,
		...censusObservations,
	].map((observations) => {
		const path = join(
			outputDirectory,
			`${observations.measureId}-observations.json`,
		);
		writeFileSync(path, `${JSON.stringify(observations, null, "\t")}\n`);
		return path;
	});
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
		measureObservationPaths,
		measureRecordCount: [
			...mobileCoverageObservations,
			...censusObservations,
		].reduce(
			(count, observations) =>
				count +
				observations.periods.reduce(
					(periodCount, period) => periodCount + period.records.length,
					0,
				),
			0,
		),
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
		`Wrote data catalogue, ${result.wardRecordCount} ward observations, ${result.localAuthorityRecordCount} local-authority observations, ${result.emissionsRecordCount} emissions observations and ${result.measureRecordCount} other measure observations to ${result.catalogPath}`,
	);
}
