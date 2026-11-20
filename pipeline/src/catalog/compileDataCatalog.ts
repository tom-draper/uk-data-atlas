import { type DatasetInput, readDatasetInput } from "./input.ts";
import type {
	DataCatalog,
	MeasureObservationArtifact,
	AnyMeasureObservationArtifact,
} from "@uk-data-atlas/catalogue/node";
import { sha256 } from "./values.ts";
import {
	type CatalogManifest,
	type CompiledMeasure,
	type DatasetManifest,
	compileDataset,
} from "./manifest.ts";
import { RECODED_2025 } from "./authorityChanges.ts";
import { compileElections } from "./elections.ts";
import { compileHousePrice } from "./housePrice.ts";
import { compileLifeExpectancy } from "./lifeExpectancy.ts";
import type { CatalogueRows } from "./rows.ts";
import { compilePopulationDensity } from "./populationDensity.ts";
import { mergeMeasurePartitions } from "./indicators.ts";
import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import {
	compileDeclaredIndicators,
	compileYearlyIndicators,
} from "./declaredIndicators.ts";
import { compileRoadCollisions } from "./roadCollisions.ts";
import { compileCrime } from "./crime.ts";
import { compileUnemployment } from "./unemployment.ts";
import { compileCensus } from "./census.ts";
import { compileCensusSmallArea } from "./censusSmallArea.ts";
import { withAliases } from "./measureAliases.ts";
import type { MeasureTableArtifact } from "@uk-data-atlas/catalogue/node";
import type { MeasureSource } from "@uk-data-atlas/measures";
import { compileJobs } from "./jobs.ts";
import { compileRegionalGdp } from "./regionalGdp.ts";
import { compileEnergyConsumption } from "./energyConsumption.ts";
import { compilePopulation } from "./population.ts";
import { withNationalVariants } from "./nationalVariants.ts";

/**
 * The compiled files the catalogue is built from, by name. Named rather than
 * positional because every published measure adds one, and a shifted
 * positional list compiles fine while reading the wrong file.
 */
export type DataCatalogInputs<Input = DatasetInput> = {
	manifest: Input;
	/**
	 * The statistics rows the measures that no longer read a compiled file
	 * are built from.
	 */
	rows: CatalogueRows;
	/**
	 * The repository root, whose data/ directory holds the Census 2021
	 * small-area tables compiled straight from their Nomis files.
	 */
	censusSmallAreaRoot?: string;
};

/**
 * Compile source-lineage metadata and every published measure, each from its
 * own module. The modules run in a fixed order, so a malformed input is always
 * reported by the same check. No measure selects a geometry release: the
 * published inputs declare code vintages, not boundary months.
 */
export const compileDataCatalog = ({
	manifest: manifestPath,
	rows,
	censusSmallAreaRoot,
}: DataCatalogInputs): {
	catalog: DataCatalog;
	/** Wards in 2022, local authorities and constituencies by mid-year. */
	populationObservations: MeasureObservationArtifact[];
	regionalGdpObservations: MeasureObservationArtifact[];
	energyConsumptionObservations: MeasureObservationArtifact[];
	jobsObservations: MeasureObservationArtifact;
	yearlyIndicatorObservations: MeasureObservationArtifact[];
	indicatorObservations: MeasureObservationArtifact[];
	observationDatasets: ReadonlyMap<AnyMeasureObservationArtifact, string>;
	statisticsFields: Array<{
		measureId: string;
		field: NonNullable<CompiledMeasure["statisticsField"]>;
	}>;
	censusObservations: MeasureObservationArtifact[];
	populationDensityObservations: MeasureObservationArtifact;
	housePriceObservations: MeasureObservationArtifact;
	lifeExpectancyObservations: MeasureObservationArtifact[];
	electionObservations: AnyMeasureObservationArtifact[];
	censusTables: MeasureTableArtifact[];
} => {
	const manifest = JSON.parse(
		readDatasetInput(manifestPath),
	) as DatasetManifest;
	if (
		typeof manifest.version !== "number" ||
		!Array.isArray(manifest.datasets)
	) {
		throw new Error(`${manifestPath} is not a dataset manifest`);
	}
	const censusSmallArea = censusSmallAreaRoot
		? compileCensusSmallArea(censusSmallAreaRoot, rows)
		: undefined;
	const datasets = [
		...manifest.datasets.map(compileDataset),
		...(censusSmallArea?.datasets ?? []),
	].sort((left, right) => left.id.localeCompare(right.id));
	if (
		new Set(datasets.map((dataset) => dataset.id)).size !== datasets.length
	) {
		throw new Error(`${manifestPath} has duplicate dataset outputs`);
	}
	const catalogManifest: CatalogManifest = { manifestPath, datasets };
	const population = compilePopulation(catalogManifest, rows);
	const populationCodes = new Set(
		population.localAuthorityObservations.periods[0]?.records.map(
			(record) => record.areaCode,
		),
	);
	const energyConsumption = compileEnergyConsumption(catalogManifest, rows);
	const regionalGdp = compileRegionalGdp(catalogManifest, rows);
	const jobs = compileJobs(catalogManifest, rows, populationCodes);
	const yearly = DATASET_DECLARATIONS.filter(
		(declaration) => declaration.catalogue?.yearly,
	).map((declaration) => ({
		datasetId: declaration.id,
		...compileYearlyIndicators(catalogManifest, declaration, rows),
	}));
	const census = compileCensus(catalogManifest, rows, populationCodes);
	const england2023 = [...populationCodes].filter((code) =>
		code.startsWith("E"),
	);
	const england2025 = england2023.map((code) => RECODED_2025[code] ?? code);
	const indicatorObservations = [
		...DATASET_DECLARATIONS.filter(
			(declaration) =>
				declaration.catalogue && !declaration.catalogue.yearly,
		).flatMap((declaration) =>
			compileDeclaredIndicators(catalogManifest, declaration, rows, {
				authorities: populationCodes,
				england2025,
			}),
		),
		...compileRoadCollisions(catalogManifest, rows, populationCodes),
		...compileCrime(catalogManifest, rows),
	];
	const unemployment = compileUnemployment(
		catalogManifest,
		rows,
		populationCodes,
	);
	const indicatorMeasures = mergeMeasurePartitions(indicatorObservations);

	const density = compilePopulationDensity(
		catalogManifest,
		rows,
		population.localAuthorityObservations.periods,
	);
	const housePrice = compileHousePrice(catalogManifest, rows);
	const lifeExpectancy = compileLifeExpectancy(rows);
	const elections = compileElections(catalogManifest, rows);
	// Small-area census partitions of a census question already published by
	// local authority join that measure, rather than standing beside it.
	for (const measure of census.measures) {
		const partitions = censusSmallArea?.partitions.get(measure.id);
		if (partitions)
			(measure.sources as MeasureSource[]).push(...partitions);
	}
	const unclaimed = [...(censusSmallArea?.partitions.keys() ?? [])].filter(
		(measureId) =>
			!census.measures.some((measure) => measure.id === measureId),
	);
	if (unclaimed.length > 0)
		throw new Error(
			`No census measure takes the small-area partitions of ${unclaimed.join(", ")}.`,
		);
	const measures = withAliases(
		withNationalVariants([
			population.measure,
			...elections.measures,
			density.measure,
			housePrice.measure,
			...lifeExpectancy.measures,
			...regionalGdp.measures,
			...energyConsumption.measures,
			jobs.measure,
			...yearly.flatMap(({ measures }) => measures),
			...indicatorMeasures,
			...unemployment.measures,
			...census.measures,
			...(censusSmallArea?.measures ?? []),
		]),
	);
	const catalogContent = JSON.stringify({
		schemaVersion: 1,
		source: {
			artifact: "data/datasets/dataset-manifest.json",
			manifestVersion: manifest.version,
		},
		datasets,
		measures,
	});
	return {
		catalog: {
			schemaVersion: 1,
			contentHash: sha256(catalogContent),
			source: {
				artifact: "data/datasets/dataset-manifest.json",
				manifestVersion: manifest.version,
			},
			datasets,
			measures,
		},
		censusTables: censusSmallArea?.tables ?? [],
		populationObservations: [
			population.wardObservations,
			population.localAuthorityObservations,
			population.constituencyObservations,
		],
		regionalGdpObservations: regionalGdp.artifacts,
		energyConsumptionObservations: energyConsumption.artifacts,
		jobsObservations: jobs.artifact,
		yearlyIndicatorObservations: yearly.flatMap(
			({ artifacts }) => artifacts,
		),
		censusObservations: census.artifacts,
		indicatorObservations: [
			...indicatorObservations.map(({ artifact }) => artifact),
			...unemployment.artifacts,
		],
		observationDatasets: new Map<AnyMeasureObservationArtifact, string>([
			[population.wardObservations, "population"],
			[population.localAuthorityObservations, "population-uk"],
			[population.constituencyObservations, "population-constituency"],
			[jobs.artifact, "jobs"],
			[density.artifact, "population-uk"],
			[housePrice.artifact, "house-price"],
			...regionalGdp.artifacts.map(
				(artifact): [AnyMeasureObservationArtifact, string] => [
					artifact,
					"regional-gdp",
				],
			),
			...unemployment.artifacts.map(
				(artifact): [AnyMeasureObservationArtifact, string] => [
					artifact,
					"unemployment",
				],
			),
			...lifeExpectancy.artifacts.map(
				(artifact): [AnyMeasureObservationArtifact, string] => [
					artifact,
					"life-expectancy-series",
				],
			),
			...yearly.flatMap(({ datasetId, artifacts }) =>
				artifacts.map(
					(artifact): [AnyMeasureObservationArtifact, string] => [
						artifact,
						datasetId,
					],
				),
			),
			...indicatorObservations.map(
				({
					measure,
					artifact,
				}): [AnyMeasureObservationArtifact, string] => [
					artifact,
					measure.sources[0]!.datasetId,
				],
			),
			...census.observationDatasets,
			...energyConsumption.observationDatasets,
			...elections.observationDatasets,
		]),
		statisticsFields: indicatorObservations.flatMap(
			({ measure, statisticsField }) =>
				statisticsField
					? [{ measureId: measure.id, field: statisticsField }]
					: [],
		),
		lifeExpectancyObservations: lifeExpectancy.artifacts,
		electionObservations: elections.artifacts,
		housePriceObservations: housePrice.artifact,
		populationDensityObservations: density.artifact,
	};
};
