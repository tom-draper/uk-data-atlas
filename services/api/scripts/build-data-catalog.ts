import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileDataCatalog,
	type DataCatalogInputs,
} from "../src/catalog/compileDataCatalog";
import { observationArtifactName } from "../src/dataCatalog";

export const buildDataCatalog = (repositoryRoot: string) => {
	const precompiled = (file: string) =>
		join(repositoryRoot, "public", "data", "datasets", file);
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
		roadCollisions: precompiled("road-collisions.json"),
		income: precompiled("income.json"),
		workplaceIncome: precompiled("workplace-income.json"),
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
		regionalGdpItl1: precompiled("regional-gdp-itl1.json"),
		regionalGdpItl2: precompiled("regional-gdp-itl2.json"),
		regionalGdpItl3: precompiled("regional-gdp-itl3.json"),
		electricityConsumption: precompiled("electricity-consumption.json"),
		gasConsumption: precompiled("gas-consumption.json"),
		businessActivity: precompiled("business-activity.json"),
		netAdditionalDwellings: precompiled("net-additional-dwellings.json"),
		localGovernmentFinance: precompiled("local-government-finance.json"),
		councilTax: precompiled("council-tax.json"),
		waste: precompiled("waste.json"),
		adultSocialCareActivity: precompiled("adult-social-care-activity.json"),
		adultSocialCareOutcomes: precompiled("adult-social-care-outcomes.json"),
		planningApplications: precompiled("planning-applications.json"),
		electricVehicleChargers: precompiled("electric-vehicle-chargers.json"),
		censusSmallAreaRoot: repositoryRoot,
	};
	const missing = Object.values(inputs).filter(
		(path): path is string => !path || !existsSync(path),
	);
	if (missing.length > 0) {
		throw new Error(
			`Build the website's precompiled data before the API data catalogue. Missing: ${missing.join(", ")}`,
		);
	}
	const outputDirectory = join(repositoryRoot, "services", "api", "public");
	const {
		catalog,
		populationObservations,
		ghgEmissionsObservations,
		jobsObservations,
		mobileCoverageObservations,
		censusObservations,
		regionalGdpObservations,
		energyConsumptionObservations,
		indicatorObservations,
		populationDensityObservations,
		housePriceObservations,
		imdObservations,
		nimdmObservations,
		lifeExpectancyObservations,
		electionObservations,
		censusTables,
	} = compileDataCatalog(inputs);
	const catalogPath = join(outputDirectory, "data-catalog.json");
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
	const measureObservationPaths = [
		...populationObservations,
		jobsObservations,
		...mobileCoverageObservations,
		...censusObservations,
		...regionalGdpObservations,
		...energyConsumptionObservations,
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
	// A table serves several measures, which each name it, so it is written
	// once under its own name.
	const tablePaths = censusTables.map((table) => {
		const path = join(outputDirectory, `${table.id}.json`);
		writeFileSync(path, `${JSON.stringify(table)}\n`);
		return path;
	});
	return {
		catalogPath,
		ghgEmissionsObservationsPath,
		measureObservationPaths: [...measureObservationPaths, ...tablePaths],
		populationRecordCount: populationObservations.reduce(
			(count, observations) =>
				count +
				observations.periods.reduce(
					(periodCount, period) =>
						periodCount + period.records.length,
					0,
				),
			0,
		),
		measureRecordCount: [
			jobsObservations,
			...mobileCoverageObservations,
			...censusObservations,
			...regionalGdpObservations,
			...energyConsumptionObservations,
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
	};
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildDataCatalog(repositoryRoot);
	console.log(
		`Wrote data catalogue, ${result.populationRecordCount} population observations, ${result.emissionsRecordCount} emissions observations and ${result.measureRecordCount} other measure observations to ${result.catalogPath}`,
	);
}
