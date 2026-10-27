import { AtlasDatasetInput } from "./catalog/input";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileDataCatalog,
	type DataCatalogInputs,
} from "./catalog/compileDataCatalog";
import { storeObservations } from "./store-observations";
import { observationArtifactName } from "../../shared/dataCatalog";
import { artifactDirectory } from "../../shared/dataLayout";

export const datasetCatalogInputs = (
	repositoryRoot: string,
): DataCatalogInputs => {
	const precompiled = (file: string) =>
		new AtlasDatasetInput(repositoryRoot, file.replace(/\.json$/, ""));
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
	return inputs;
};

export const buildDataCatalog = (repositoryRoot: string) => {
	const inputs = datasetCatalogInputs(repositoryRoot);
	const outputDirectory = artifactDirectory(repositoryRoot);
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
	const observationArtifacts = [
		ghgEmissionsObservations,
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
	];
	function* observationEntries(): Generator<readonly [string, string]> {
		for (const observations of observationArtifacts) {
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
			yield [
				observationArtifactName(observations.measureId, source),
				`${JSON.stringify(observations)}\n`,
			] as const;
		}
		for (const table of censusTables)
			yield [table.id, `${JSON.stringify(table)}\n`];
	}
	const databasePath = storeObservations(
		repositoryRoot,
		catalog,
		observationEntries(),
	);
	writeFileSync(catalogPath, `${JSON.stringify(catalog, null, "\t")}\n`);
	return {
		catalogPath,
		databasePath,
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
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildDataCatalog(repositoryRoot);
	console.log(
		`Wrote data catalogue, ${result.populationRecordCount} population observations, ${result.emissionsRecordCount} emissions observations and ${result.measureRecordCount} other measure observations to ${result.catalogPath}`,
	);
}
