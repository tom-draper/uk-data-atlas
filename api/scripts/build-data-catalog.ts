import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileDataCatalog,
	type DataCatalogInputs,
	observationArtifactName,
} from "../src/dataCatalog";

export const buildDataCatalog = (repositoryRoot: string) => {
	const precompiled = (file: string) =>
		join(repositoryRoot, "data", "precompiled", file);
	const inputs: DataCatalogInputs = {
		manifest: precompiled("dataset-manifest.json"),
		population: precompiled("population.json"),
		populationUk: precompiled("population-uk.json"),
		ghgEmissions: precompiled("ghg-emissions.json"),
		mobileCoverage: precompiled("mobile-coverage.json"),
		travelToWork: precompiled("travel-to-work.json"),
		carAvailability: precompiled("car-availability.json"),
		qualification: precompiled("qualification.json"),
		ethnicity: precompiled("ethnicity.json"),
		broadband: precompiled("broadband.json"),
		claimantCount: precompiled("claimant-count.json"),
		homelessness: precompiled("homelessness.json"),
		income: precompiled("income.json"),
		crime: precompiled("crime.json"),
		airQuality: precompiled("air-quality.json"),
		unemployment: precompiled("unemployment.json"),
		jobs: precompiled("jobs.json"),
		landArea: precompiled("land-area.json"),
		housePrice: precompiled("house-price.json"),
		imd: precompiled("imd.json"),
		nimdm: precompiled("nimdm.json"),
		wimd: precompiled("wimd.json"),
		simd: precompiled("simd.json"),
		lifeExpectancySeries: precompiled("life-expectancy-series.json"),
		populationConstituency: precompiled("population-constituency.json"),
		generalElection: precompiled("general-election.json"),
		localElection: precompiled("local-election.json"),
	};
	const missing = Object.values(inputs).filter((path) => !existsSync(path));
	if (missing.length > 0) {
		throw new Error(
			`Build the website's precompiled data before the API data catalogue. Missing: ${missing.join(", ")}`,
		);
	}
	const outputDirectory = join(repositoryRoot, "api", "public");
	const {
		catalog,
		populationObservations,
		populationLocalAuthorityObservations,
		ghgEmissionsObservations,
		jobsObservations,
		mobileCoverageObservations,
		censusObservations,
		indicatorObservations,
		populationDensityObservations,
		housePriceObservations,
		imdObservations,
		nimdmObservations,
		lifeExpectancyObservations,
		populationConstituencyObservations,
		electionObservations,
	} = compileDataCatalog(inputs);
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
	// The catalogue is read by people, so it stays indented. Observation
	// artifacts are read only by the server and run to hundreds of thousands of
	// records, where indentation roughly doubles the size on disk.
	writeFileSync(catalogPath, `${JSON.stringify(catalog, null, "\t")}\n`);
	writeFileSync(
		ghgEmissionsObservationsPath,
		`${JSON.stringify(ghgEmissionsObservations)}\n`,
	);
	// A further source of a multi-source measure is named for its dataset.
	writeFileSync(
		join(outputDirectory, "population-constituency-observations.json"),
		`${JSON.stringify(populationConstituencyObservations)}\n`,
	);
	const measureObservationPaths = [
		jobsObservations,
		...mobileCoverageObservations,
		...censusObservations,
		...indicatorObservations,
		populationDensityObservations,
		housePriceObservations,
		...imdObservations,
		nimdmObservations,
		...lifeExpectancyObservations,
		...electionObservations,
	].map((observations) => {
		const measure = catalog.measures.find(
			(candidate) => candidate.id === observations.measureId,
		);
		const source = measure?.sources.find(
			(candidate) =>
				candidate.sourceGeography.type ===
					observations.sourceGeography.type &&
				candidate.sourceGeography.boundaryYear ===
					observations.sourceGeography.boundaryYear,
		);
		if (!measure || !source) {
			throw new Error(
				`No catalogue source matches ${observations.measureId} on ${observations.sourceGeography.type} ${observations.sourceGeography.boundaryYear}.`,
			);
		}
		const path = join(
			outputDirectory,
			`${observationArtifactName(observations.measureId, source)}.json`,
		);
		writeFileSync(path, `${JSON.stringify(observations)}\n`);
		return path;
	});
	writeFileSync(
		observationsPath,
		`${JSON.stringify(populationObservations)}\n`,
	);
	writeFileSync(
		localAuthorityObservationsPath,
		`${JSON.stringify(populationLocalAuthorityObservations)}\n`,
	);
	return {
		catalogPath,
		observationsPath,
		localAuthorityObservationsPath,
		ghgEmissionsObservationsPath,
		measureObservationPaths,
		measureRecordCount: [
			jobsObservations,
			...mobileCoverageObservations,
			...censusObservations,
			...indicatorObservations,
			populationDensityObservations,
			housePriceObservations,
			...imdObservations,
			nimdmObservations,
			...lifeExpectancyObservations,
			...electionObservations,
		].reduce(
			(count, observations) =>
				count +
				observations.periods.reduce(
					(periodCount, period) =>
						periodCount + period.records.length,
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
