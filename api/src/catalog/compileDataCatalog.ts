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
	type CatalogManifest,
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
import { compileRegionalGdp } from "./regionalGdp";
import { compilePopulation } from "./population";
import { withNationalVariants } from "./nationalVariants";

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
	regionalGdpItl1: string;
	regionalGdpItl2: string;
	regionalGdpItl3: string;
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
	regionalGdpItl1: regionalGdpItl1Path,
	regionalGdpItl2: regionalGdpItl2Path,
	regionalGdpItl3: regionalGdpItl3Path,
}: DataCatalogInputs): {
	catalog: DataCatalog;
	populationObservations: PopulationObservationArtifact;
	populationLocalAuthorityObservations: PopulationLocalAuthorityObservationArtifact;
	ghgEmissionsObservations: MeasureObservationArtifact;
	regionalGdpObservations: MeasureObservationArtifact[];
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
	const catalogManifest: CatalogManifest = { manifestPath, datasets };
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
	const regionalGdp = compileRegionalGdp(catalogManifest, {
		"regional-gdp-itl1": regionalGdpItl1Path,
		"regional-gdp-itl2": regionalGdpItl2Path,
		"regional-gdp-itl3": regionalGdpItl3Path,
	});
	const jobs = compileJobs(catalogManifest, jobsPath, populationCodes);
	const mobileCoverage = compileMobileCoverage(
		catalogManifest,
		mobileCoveragePath,
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
		...compileBroadband(catalogManifest, broadbandPath, populationCodes),
		...compileClaimantCount(
			catalogManifest,
			claimantCountPath,
			populationCodes,
		),
		...compileHomelessness(catalogManifest, homelessnessPath, england2025),
		...compileRoadCollisions(
			catalogManifest,
			roadCollisionsPath,
			populationCodes,
		),
		...compileIncome(catalogManifest, incomePath, england2025),
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
	const measures = withNationalVariants([
		population.measure,
		...elections.measures,
		density.measure,
		housePrice.measure,
		...deprivation.measures,
		nimdm.measure,
		...lifeExpectancy.measures,
		emissions.measure,
		...regionalGdp.measures,
		jobs.measure,
		...mobileCoverage.measures,
		...indicatorMeasures,
		...unemployment.measures,
		...census.measures,
	]);
	const catalogContent = JSON.stringify({
		schemaVersion: 1,
		source: {
			artifact: "data/precompiled/dataset-manifest.json",
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
				artifact: "data/precompiled/dataset-manifest.json",
				manifestVersion: manifest.version,
			},
			datasets,
			measures,
		},
		populationConstituencyObservations: population.constituencyObservations,
		populationObservations: population.wardObservations,
		populationLocalAuthorityObservations:
			population.localAuthorityObservations,
		ghgEmissionsObservations: emissions.artifact,
		regionalGdpObservations: regionalGdp.artifacts,
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
