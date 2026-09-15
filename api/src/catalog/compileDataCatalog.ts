import { readFileSync } from "node:fs";
import type {
	DataCatalog,
	PopulationObservationArtifact,
	MeasureObservationArtifact,
	AnyMeasureObservationArtifact,
	PopulationLocalAuthorityObservationArtifact,
} from "../dataCatalog";
import { sha256 } from "./values";
import {
	type CompiledMeasure,
	type DatasetManifest,
	compileDataset,
} from "./manifest";
import { RECODED_2025 } from "./authorityChanges";
import { compileElections } from "./elections";
import { compileNimdm } from "./nimdm";
import { compileHousePrice } from "./housePrice";
import { compileLifeExpectancy } from "./lifeExpectancy";
import { compileDeprivationIndices } from "./deprivation";
import { compilePopulationDensity } from "./populationDensity";
import { mergeMeasurePartitions } from "./indicators";
import { compileBroadband } from "./broadband";
import { compileClaimantCount } from "./claimantCount";
import { compileHomelessness } from "./homelessness";
import { compileRoadCollisions } from "./roadCollisions";
import { compileIncome } from "./income";
import { compileCrime } from "./crime";
import { compileUnemployment } from "./unemployment";
import { compileAirQuality } from "./airQuality";
import { compileCensus } from "./census";
import { compileMobileCoverage } from "./mobileCoverage";
import { compileJobs } from "./jobs";
import { compileEmissions } from "./emissions";
import { compilePopulation } from "./population";

/**
 * The compiled files the catalogue is built from, by name. Named rather than
 * positional because every published measure adds one, and a shifted
 * positional list compiles fine while reading the wrong file.
 */
export type DataCatalogInputs = {
	manifest: string;
	population: string;
	populationUk: string;
	ghgEmissions: string;
	mobileCoverage: string;
	travelToWork: string;
	carAvailability: string;
	qualification: string;
	ethnicity: string;
	broadband: string;
	claimantCount: string;
	homelessness: string;
	roadCollisions: string;
	income: string;
	crime: string;
	airQuality: string;
	unemployment: string;
	jobs: string;
	landArea: string;
	housePrice: string;
	imd: string;
	nimdm: string;
	wimd: string;
	simd: string;
	lifeExpectancySeries: string;
	populationConstituency: string;
	generalElection: string;
	localElection: string;
};

/**
 * Compile source-lineage metadata and one intentionally narrow, source-exact
 * population measure. It does not select a geometry release: the published
 * input records only declare the Ward 2023 code vintage, not a boundary month.
 */
export const compileDataCatalog = ({
	manifest: manifestPath,
	population: populationPath,
	populationUk: populationUkPath,
	ghgEmissions: ghgEmissionsPath,
	mobileCoverage: mobileCoveragePath,
	travelToWork: travelToWorkPath,
	carAvailability: carAvailabilityPath,
	qualification: qualificationPath,
	ethnicity: ethnicityPath,
	broadband: broadbandPath,
	claimantCount: claimantCountPath,
	homelessness: homelessnessPath,
	roadCollisions: roadCollisionsPath,
	income: incomePath,
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
}: DataCatalogInputs): {
	catalog: DataCatalog;
	populationObservations: PopulationObservationArtifact;
	populationLocalAuthorityObservations: PopulationLocalAuthorityObservationArtifact;
	ghgEmissionsObservations: MeasureObservationArtifact;
	jobsObservations: MeasureObservationArtifact;
	mobileCoverageObservations: MeasureObservationArtifact[];
	indicatorObservations: MeasureObservationArtifact[];
	censusObservations: MeasureObservationArtifact[];
	populationDensityObservations: MeasureObservationArtifact;
	housePriceObservations: MeasureObservationArtifact;
	imdObservations: MeasureObservationArtifact[];
	nimdmObservations: MeasureObservationArtifact;
	lifeExpectancyObservations: MeasureObservationArtifact[];
	populationConstituencyObservations: MeasureObservationArtifact;
	electionObservations: AnyMeasureObservationArtifact[];
} => {
	const manifest = JSON.parse(
		readFileSync(manifestPath, "utf8"),
	) as DatasetManifest;
	if (
		typeof manifest.version !== "number" ||
		!Array.isArray(manifest.datasets)
	) {
		throw new Error(`${manifestPath} is not a dataset manifest`);
	}
	const datasets = manifest.datasets
		.map(compileDataset)
		.sort((left, right) => left.id.localeCompare(right.id));
	if (
		new Set(datasets.map((dataset) => dataset.id)).size !== datasets.length
	) {
		throw new Error(`${manifestPath} has duplicate dataset outputs`);
	}
	const population = compilePopulation(
		{ manifestPath, datasets },
		populationPath,
		populationUkPath,
		populationConstituencyPath,
	);
	const populationCodes = new Set(
		population.localAuthorityObservations.periods[0]?.records.map(
			(record) => record.areaCode,
		),
	);
	const emissions = compileEmissions(
		{ manifestPath, datasets },
		ghgEmissionsPath,
	);
	const jobs = compileJobs(
		{ manifestPath, datasets },
		jobsPath,
		populationCodes,
	);
	const mobileCoverage = compileMobileCoverage(
		{ manifestPath, datasets },
		mobileCoveragePath,
	);
	const census = compileCensus(
		{ manifestPath, datasets },
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
	const indicatorObservations: CompiledMeasure[] = [];

	indicatorObservations.push(
		...compileBroadband(
			{ manifestPath, datasets },
			broadbandPath,
			populationCodes,
		),
	);
	indicatorObservations.push(
		...compileClaimantCount(
			{ manifestPath, datasets },
			claimantCountPath,
			populationCodes,
		),
	);
	indicatorObservations.push(
		...compileHomelessness(
			{ manifestPath, datasets },
			homelessnessPath,
			england2025,
		),
	);
	indicatorObservations.push(
		...compileRoadCollisions(
			{ manifestPath, datasets },
			roadCollisionsPath,
			populationCodes,
		),
	);
	indicatorObservations.push(
		...compileIncome({ manifestPath, datasets }, incomePath, england2025),
	);
	indicatorObservations.push(
		...compileCrime({ manifestPath, datasets }, crimePath),
	);
	const unemployment = compileUnemployment(
		{ manifestPath, datasets },
		unemploymentPath,
		populationCodes,
	);
	indicatorObservations.push(
		...compileAirQuality(
			{ manifestPath, datasets },
			airQualityPath,
			populationCodes,
		),
	);
	const indicatorMeasures = mergeMeasurePartitions(indicatorObservations);

	const density = compilePopulationDensity(
		{ manifestPath, datasets },
		landAreaPath,
		population.localAuthorityObservations.periods,
	);
	const housePrice = compileHousePrice(
		{ manifestPath, datasets },
		housePricePath,
	);
	const deprivation = compileDeprivationIndices(
		{ manifestPath, datasets },
		imdPath,
		wimdPath,
		simdPath,
	);
	const nimdm = compileNimdm({ manifestPath, datasets }, nimdmPath);
	const lifeExpectancy = compileLifeExpectancy(lifeExpectancySeriesPath);
	const elections = compileElections(
		{ manifestPath, datasets },
		generalElectionPath,
		localElectionPath,
	);
	const catalogContent = JSON.stringify({
		schemaVersion: 1,
		source: {
			artifact: "data/precompiled/dataset-manifest.json",
			manifestVersion: manifest.version,
		},
		datasets,
		measures: [
			population.measure,
			...elections.measures,
			density.measure,
			housePrice.measure,
			...deprivation.measures,
			nimdm.measure,
			...lifeExpectancy.measures,
			emissions.measure,
			jobs.measure,
			...mobileCoverage.measures,
			...indicatorMeasures,
			...unemployment.measures,
			...census.measures,
		],
	});
	return {
		catalog: {
			schemaVersion: 1,
			contentHash: sha256(catalogContent),
			source: {
				artifact: "data/precompiled/dataset-manifest.json",
				manifestVersion: manifest.version,
			},
			datasets,
			measures: [
				population.measure,
				...elections.measures,
				density.measure,
				housePrice.measure,
				...deprivation.measures,
				nimdm.measure,
				...lifeExpectancy.measures,
				emissions.measure,
				jobs.measure,
				...mobileCoverage.measures,
				...indicatorMeasures,
				...unemployment.measures,
				...census.measures,
			],
		},
		populationConstituencyObservations: population.constituencyObservations,
		populationObservations: population.wardObservations,
		populationLocalAuthorityObservations:
			population.localAuthorityObservations,
		ghgEmissionsObservations: emissions.artifact,
		jobsObservations: jobs.artifact,
		mobileCoverageObservations: mobileCoverage.artifacts,
		censusObservations: census.artifacts,
		indicatorObservations: [
			...indicatorObservations.map(({ artifact }) => artifact),
			...unemployment.artifacts,
		],
		imdObservations: deprivation.artifacts,
		lifeExpectancyObservations: lifeExpectancy.artifacts,
		electionObservations: elections.artifacts,
		nimdmObservations: nimdm.artifact,
		housePriceObservations: housePrice.artifact,
		populationDensityObservations: density.artifact,
	};
};
