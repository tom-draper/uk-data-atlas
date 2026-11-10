import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import { AtlasDatasetInput } from "./catalog/input.ts";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileDataCatalog,
	type DataCatalogInputs,
} from "./catalog/compileDataCatalog.ts";
import {
	assertMeasureDimensions,
	observationArtifactName,
} from "@uk-data-atlas/measures";
import {
	artifactDirectory,
	compiledObservationDirectory,
	compiledObservationPath,
} from "@uk-data-atlas/atlas-db";
import { readMeasureDimensionsConfig } from "@uk-data-atlas/measures";

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
		travelToWork: precompiled("travel-to-work.json"),
		carAvailability: precompiled("car-availability.json"),
		qualification: precompiled("qualification.json"),
		ethnicity: precompiled("ethnicity.json"),
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
		declared: Object.fromEntries(
			DATASET_DECLARATIONS.filter(
				(declaration) => declaration.catalogue,
			).map((declaration) => [
				declaration.id,
				precompiled(`${declaration.id}.json`),
			]),
		),
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
		yearlyIndicatorObservations,
		censusObservations,
		regionalGdpObservations,
		energyConsumptionObservations,
		indicatorObservations,
		statisticsFields,
		populationDensityObservations,
		housePriceObservations,
		imdObservations,
		nimdmObservations,
		lifeExpectancyObservations,
		electionObservations,
		censusTables,
	} = compileDataCatalog(inputs);
	// Every measure id must say which measure and dimension members it is,
	// so an id that encodes a breakdown is never published unmapped.
	const { config, vocabulary } = readMeasureDimensionsConfig(repositoryRoot);
	assertMeasureDimensions(catalog, config, vocabulary);
	const catalogPath = join(outputDirectory, "data-catalog.json");
	const compiledDirectory = compiledObservationDirectory(repositoryRoot);
	rmSync(compiledDirectory, { recursive: true, force: true });
	mkdirSync(compiledDirectory, { recursive: true });
	const observationArtifacts = [
		ghgEmissionsObservations,
		...populationObservations,
		jobsObservations,
		...yearlyIndicatorObservations,
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
			const name = observationArtifactName(
				observations.measureId,
				source,
			);
			const text = `${JSON.stringify(observations)}\n`;
			writeFileSync(compiledObservationPath(repositoryRoot, name), text);
			yield [name, text] as const;
		}
		for (const table of censusTables) {
			const text = `${JSON.stringify(table)}\n`;
			writeFileSync(
				compiledObservationPath(repositoryRoot, table.id),
				text,
			);
			yield [table.id, text];
		}
	}
	const required = new Set(
		catalog.measures.flatMap((measure) =>
			measure.sources.map((source) =>
				observationArtifactName(measure.id, source),
			),
		),
	);
	for (const [name] of observationEntries()) {
		if (!required.delete(name))
			throw new Error(
				`Unexpected or duplicate observation artifact: ${name}`,
			);
	}
	if (required.size)
		throw new Error(
			`Missing observation artifacts: ${[...required].join(", ")}`,
		);
	writeFileSync(catalogPath, `${JSON.stringify(catalog, null, "\t")}\n`);
	writeFileSync(
		join(repositoryRoot, "data/build/measure-statistics-fields.json"),
		`${JSON.stringify(statisticsFields)}\n`,
	);
	return {
		catalogPath,
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
			...yearlyIndicatorObservations,
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
