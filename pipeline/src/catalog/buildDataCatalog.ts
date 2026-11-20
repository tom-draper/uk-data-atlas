import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import { AtlasDatasetInput } from "./input.ts";
import { CatalogueRows } from "./rows.ts";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	compileDataCatalog,
	type DataCatalogInputs,
} from "./compileDataCatalog.ts";
import { assertMeasureDimensions } from "@uk-data-atlas/measures";
import {
	artifactDirectory,
	compiledObservationDirectory,
} from "@uk-data-atlas/atlas-db";
import { readMeasureDimensionsConfig } from "@uk-data-atlas/measures";
import { catalogueWithSeries } from "./catalogueSeries.ts";
import { validateObservationSeries } from "./observationSeries.ts";

export const datasetCatalogInputs = (
	repositoryRoot: string,
): DataCatalogInputs => {
	const precompiled = (file: string) =>
		new AtlasDatasetInput(
			repositoryRoot,
			file.replace(/\.json$/, ""),
			"rows",
		);
	const inputs: DataCatalogInputs = {
		rows: CatalogueRows.open(repositoryRoot),
		manifest: precompiled("dataset-manifest.json"),
		population: precompiled("population.json"),
		populationUk: precompiled("population-uk.json"),
		travelToWork: precompiled("travel-to-work.json"),
		carAvailability: precompiled("car-availability.json"),
		qualification: precompiled("qualification.json"),
		ethnicity: precompiled("ethnicity.json"),
		roadCollisions: precompiled("road-collisions.json"),
		crime: precompiled("crime.json"),
		landArea: precompiled("land-area.json"),
		populationConstituency: precompiled("population-constituency.json"),
		generalElection: precompiled("general-election.json"),
		localElection: precompiled("local-election.json"),
		electricityConsumption: precompiled("electricity-consumption.json"),
		gasConsumption: precompiled("gas-consumption.json"),
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
		catalog: sourceCatalog,
		populationObservations,
		jobsObservations,
		yearlyIndicatorObservations,
		censusObservations,
		regionalGdpObservations,
		energyConsumptionObservations,
		indicatorObservations,
		observationDatasets,
		statisticsFields,
		populationDensityObservations,
		housePriceObservations,
		lifeExpectancyObservations,
		electionObservations,
		censusTables,
	} = compileDataCatalog(inputs);
	inputs.rows.close();
	// Every measure id must say which measure and dimension members it is,
	// so an id that encodes a breakdown is never published unmapped.
	const { config, vocabulary } = readMeasureDimensionsConfig(repositoryRoot);
	const catalog = catalogueWithSeries(sourceCatalog);
	assertMeasureDimensions(catalog, config, vocabulary);
	const catalogPath = join(outputDirectory, "data-catalog.json");
	// Remove artifacts from older builds; observations now come from rows.
	rmSync(compiledObservationDirectory(repositoryRoot), {
		recursive: true,
		force: true,
	});
	const observationArtifacts = [
		...populationObservations,
		jobsObservations,
		...yearlyIndicatorObservations,
		...censusObservations,
		...regionalGdpObservations,
		...energyConsumptionObservations,
		...indicatorObservations,
		populationDensityObservations,
		housePriceObservations,
		...lifeExpectancyObservations,
		...electionObservations,
	];
	validateObservationSeries(
		catalog,
		observationArtifacts,
		censusTables,
		observationDatasets,
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
		emissionsRecordCount: yearlyIndicatorObservations
			.filter(
				(artifact) =>
					observationDatasets.get(artifact) === "ghg-emissions",
			)
			.reduce(
				(count, { periods }) =>
					count +
					periods.reduce(
						(total, period) => total + period.records.length,
						0,
					),
				0,
			),
	};
};
