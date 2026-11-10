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
import { compileNimdm } from "./nimdm.ts";
import { compileHousePrice } from "./housePrice.ts";
import { compileLifeExpectancy } from "./lifeExpectancy.ts";
import { compileDeprivationIndices } from "./deprivation.ts";
import { compilePopulationDensity } from "./populationDensity.ts";
import { mergeMeasurePartitions } from "./indicators.ts";
import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import {
	compileDeclaredIndicators,
	compileYearlyIndicators,
} from "./declaredIndicators.ts";
import { compileHomelessness } from "./homelessness.ts";
import { compileRoadCollisions } from "./roadCollisions.ts";
import { compileIncome } from "./income.ts";
import { compileCrime } from "./crime.ts";
import { compileUnemployment } from "./unemployment.ts";
import { compileAirQuality } from "./airQuality.ts";
import { compileCensus } from "./census.ts";
import { compileCensusSmallArea } from "./censusSmallArea.ts";
import { withAliases } from "./measureAliases.ts";
import type { MeasureTableArtifact } from "@uk-data-atlas/catalogue/node";
import type { MeasureSource } from "@uk-data-atlas/measures";
import { compileJobs } from "./jobs.ts";
import { compileEmissions } from "./emissions.ts";
import { compileRegionalGdp } from "./regionalGdp.ts";
import { compileEnergyConsumption } from "./energyConsumption.ts";
import { compilePopulation } from "./population.ts";
import { withNationalVariants } from "./nationalVariants.ts";
import { compileNewDatasets, NEW_DATASET_MEASURES } from "./newDatasets.ts";

/**
 * The compiled files the catalogue is built from, by name. Named rather than
 * positional because every published measure adds one, and a shifted
 * positional list compiles fine while reading the wrong file.
 */
export type DataCatalogInputs<Input = DatasetInput> = {
	manifest: Input;
	population: Input;
	populationUk: Input;
	ghgEmissions: Input;
	travelToWork: Input;
	carAvailability: Input;
	qualification: Input;
	ethnicity: Input;
	homelessness: Input;
	roadCollisions: Input;
	income: Input;
	workplaceIncome: Input;
	crime: Input;
	airQuality: Input;
	unemployment: Input;
	jobs: Input;
	landArea: Input;
	housePrice: Input;
	imd: Input;
	nimdm: Input;
	wimd: Input;
	simd: Input;
	lifeExpectancySeries: Input;
	populationConstituency: Input;
	generalElection: Input;
	localElection: Input;
	regionalGdpItl1: Input;
	regionalGdpItl2: Input;
	regionalGdpItl3: Input;
	electricityConsumption: Input;
	gasConsumption: Input;
	businessActivity?: Input;
	netAdditionalDwellings?: Input;
	localGovernmentFinance?: Input;
	councilTax?: Input;
	waste?: Input;
	adultSocialCareActivity?: Input;
	adultSocialCareOutcomes?: Input;
	planningApplications?: Input;
	electricVehicleChargers?: Input;
	/** The compiled file of each declared dataset that publishes measures, by id. */
	declared?: Record<string, Input>;
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
	population: populationPath,
	populationUk: populationUkPath,
	ghgEmissions: ghgEmissionsPath,
	travelToWork: travelToWorkPath,
	carAvailability: carAvailabilityPath,
	qualification: qualificationPath,
	ethnicity: ethnicityPath,
	homelessness: homelessnessPath,
	roadCollisions: roadCollisionsPath,
	income: incomePath,
	workplaceIncome: workplaceIncomePath,
	crime: crimePath,
	airQuality: airQualityPath,
	unemployment: unemploymentPath,
	jobs: jobsPath,
	landArea: landAreaPath,
	housePrice: housePricePath,
	imd: imdPath,
	nimdm: nimdmPath,
	wimd: wimdPath,
	simd: simdPath,
	lifeExpectancySeries: lifeExpectancySeriesPath,
	populationConstituency: populationConstituencyPath,
	generalElection: generalElectionPath,
	localElection: localElectionPath,
	regionalGdpItl1: regionalGdpItl1Path,
	regionalGdpItl2: regionalGdpItl2Path,
	regionalGdpItl3: regionalGdpItl3Path,
	electricityConsumption: electricityConsumptionPath,
	gasConsumption: gasConsumptionPath,
	businessActivity: businessActivityPath,
	netAdditionalDwellings: netAdditionalDwellingsPath,
	localGovernmentFinance: localGovernmentFinancePath,
	councilTax: councilTaxPath,
	waste: wastePath,
	adultSocialCareActivity: adultSocialCareActivityPath,
	adultSocialCareOutcomes: adultSocialCareOutcomesPath,
	planningApplications: planningApplicationsPath,
	electricVehicleChargers: electricVehicleChargersPath,
	declared = {},
	censusSmallAreaRoot,
}: DataCatalogInputs): {
	catalog: DataCatalog;
	/** Wards in 2022, local authorities and constituencies by mid-year. */
	populationObservations: MeasureObservationArtifact[];
	ghgEmissionsObservations: MeasureObservationArtifact;
	regionalGdpObservations: MeasureObservationArtifact[];
	energyConsumptionObservations: MeasureObservationArtifact[];
	jobsObservations: MeasureObservationArtifact;
	yearlyIndicatorObservations: MeasureObservationArtifact[];
	indicatorObservations: MeasureObservationArtifact[];
	statisticsFields: Array<{
		measureId: string;
		field: NonNullable<CompiledMeasure["statisticsField"]>;
	}>;
	censusObservations: MeasureObservationArtifact[];
	populationDensityObservations: MeasureObservationArtifact;
	housePriceObservations: MeasureObservationArtifact;
	imdObservations: MeasureObservationArtifact[];
	nimdmObservations: MeasureObservationArtifact;
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
		? compileCensusSmallArea(censusSmallAreaRoot)
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
	const hasWorkplaceIncome = datasets.some(
		(dataset) => dataset.id === "workplace-income",
	);
	const population = compilePopulation(
		catalogManifest,
		populationPath,
		populationUkPath,
		populationConstituencyPath,
	);
	const populationCodes = new Set(
		population.localAuthorityObservations.periods[0]?.records.map(
			(record) => record.areaCode,
		),
	);
	const emissions = compileEmissions(catalogManifest, ghgEmissionsPath);
	const energyConsumption = compileEnergyConsumption(catalogManifest, {
		"electricity-consumption": electricityConsumptionPath,
		"gas-consumption": gasConsumptionPath,
	});
	const regionalGdp = compileRegionalGdp(catalogManifest, {
		"regional-gdp-itl1": regionalGdpItl1Path,
		"regional-gdp-itl2": regionalGdpItl2Path,
		"regional-gdp-itl3": regionalGdpItl3Path,
	});
	const jobs = compileJobs(catalogManifest, jobsPath, populationCodes);
	const declaredFile = (id: string) => {
		const path = declared[id];
		if (!path) throw new Error(`No compiled file for ${id}`);
		return path;
	};
	const yearly = DATASET_DECLARATIONS.filter(
		(declaration) => declaration.catalogue?.yearly,
	).map((declaration) =>
		compileYearlyIndicators(
			catalogManifest,
			declaration,
			declaredFile(declaration.id),
		),
	);
	const census = compileCensus(
		catalogManifest,
		travelToWorkPath,
		carAvailabilityPath,
		qualificationPath,
		ethnicityPath,
		populationCodes,
	);
	const england2023 = [...populationCodes].filter((code) =>
		code.startsWith("E"),
	);
	const england2025 = england2023.map((code) => RECODED_2025[code] ?? code);
	const indicatorObservations = [
		...DATASET_DECLARATIONS.filter(
			(declaration) =>
				declaration.catalogue && !declaration.catalogue.yearly,
		).flatMap((declaration) =>
			compileDeclaredIndicators(
				catalogManifest,
				declaration,
				declaredFile(declaration.id),
				{ authorities: populationCodes },
			),
		),
		...compileHomelessness(catalogManifest, homelessnessPath, england2025),
		...compileRoadCollisions(
			catalogManifest,
			roadCollisionsPath,
			populationCodes,
		),
		...compileIncome(catalogManifest, incomePath, england2025),
		...(hasWorkplaceIncome
			? compileIncome(catalogManifest, workplaceIncomePath, england2025, {
					datasetId: "workplace-income",
				})
			: []),
		...compileCrime(catalogManifest, crimePath),
	];
	const unemployment = compileUnemployment(
		catalogManifest,
		unemploymentPath,
		populationCodes,
	);
	// Air quality is published with the indicators but has always been
	// compiled after unemployment, so a malformed input fails the same check.
	indicatorObservations.push(
		...compileAirQuality(catalogManifest, airQualityPath, populationCodes),
	);
	const newDatasetPaths = {
		businessActivity: businessActivityPath,
		netAdditionalDwellings: netAdditionalDwellingsPath,
		localGovernmentFinance: localGovernmentFinancePath,
		councilTax: councilTaxPath,
		waste: wastePath,
		adultSocialCareActivity: adultSocialCareActivityPath,
		adultSocialCareOutcomes: adultSocialCareOutcomesPath,
		planningApplications: planningApplicationsPath,
		electricVehicleChargers: electricVehicleChargersPath,
	};
	if (Object.values(newDatasetPaths).every((path): path is string => !!path))
		indicatorObservations.push(
			...compileNewDatasets(
				catalogManifest,
				NEW_DATASET_MEASURES(newDatasetPaths),
			),
		);
	const indicatorMeasures = mergeMeasurePartitions(indicatorObservations);

	const density = compilePopulationDensity(
		catalogManifest,
		landAreaPath,
		population.localAuthorityObservations.periods,
	);
	const housePrice = compileHousePrice(catalogManifest, housePricePath);
	const deprivation = compileDeprivationIndices(
		catalogManifest,
		imdPath,
		wimdPath,
		simdPath,
	);
	const nimdm = compileNimdm(catalogManifest, nimdmPath);
	const lifeExpectancy = compileLifeExpectancy(lifeExpectancySeriesPath);
	const elections = compileElections(
		catalogManifest,
		generalElectionPath,
		localElectionPath,
	);
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
			...deprivation.measures,
			nimdm.measure,
			...lifeExpectancy.measures,
			emissions.measure,
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
		ghgEmissionsObservations: emissions.artifact,
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
		statisticsFields: indicatorObservations.flatMap(
			({ measure, statisticsField }) =>
				statisticsField
					? [{ measureId: measure.id, field: statisticsField }]
					: [],
		),
		imdObservations: deprivation.artifacts,
		lifeExpectancyObservations: lifeExpectancy.artifacts,
		electionObservations: elections.artifacts,
		nimdmObservations: nimdm.artifact,
		housePriceObservations: housePrice.artifact,
		populationDensityObservations: density.artifact,
	};
};
