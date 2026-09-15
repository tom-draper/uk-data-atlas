import { readFileSync } from "node:fs";
import type {
	Measure,
	DataCatalog,
	PopulationObservation,
	PopulationObservationArtifact,
	MeasureObservationArtifact,
	AnyMeasureObservationArtifact,
	PopulationLocalAuthorityObservationArtifact,
} from "../dataCatalog";
import { type PopulationFile, sha256, number, object } from "./values";
import {
	type CompiledMeasure,
	type DatasetManifest,
	compileDataset,
} from "./manifest";
import { countriesFor } from "./countries";
import { localAuthorityFieldPeriods } from "./localAuthorityFields";
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

const recordsFromData = (
	data: Record<string, unknown>,
	path: string,
	codePattern: RegExp,
): PopulationObservation[] =>
	Object.entries(data)
		.map(([areaCode, record]) => {
			if (!codePattern.test(areaCode)) {
				throw new Error(`${path}: unsupported area code ${areaCode}`);
			}
			const total = object(
				object(record, `${path}.${areaCode}`).total,
				`${path}.${areaCode}.total`,
			);
			const values = Object.entries(total);
			if (values.length === 0)
				throw new Error(`${path}.${areaCode}.total is empty`);
			return {
				areaCode,
				value: values.reduce(
					(sum, [age, value]) =>
						sum + number(value, `${path}.${areaCode}.total.${age}`),
					0,
				),
				status: "observed" as const,
			};
		})
		.sort((left, right) => left.areaCode.localeCompare(right.areaCode));

const populationRecords = (path: string): PopulationObservation[] => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PopulationFile;
	const period = object(source["2022"], `${path}.2022`);
	if (period.boundaryYear !== 2023 || period.boundaryType !== "ward") {
		throw new Error(
			`${path}: expected 2022 ward data on the 2023 code vintage`,
		);
	}
	return recordsFromData(
		object(period.data, `${path}.2022.data`),
		path,
		/^[EW]\d{8}$/,
	);
};

const localAuthorityPopulationRecords = (
	path: string,
): PopulationLocalAuthorityObservationArtifact["periods"] => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PopulationFile;
	const periods = Object.entries(source)
		.map(([period, value]) => {
			if (!/^\d{4}$/.test(period)) {
				throw new Error(`${path}: invalid population period ${period}`);
			}
			const entry = object(value, `${path}.${period}`);
			if (
				entry.year !== Number(period) ||
				entry.boundaryYear !== 2023 ||
				entry.boundaryType !== "localAuthority"
			) {
				throw new Error(
					`${path}.${period}: expected local-authority data on the 2023 code vintage`,
				);
			}
			return {
				period,
				records: recordsFromData(
					object(entry.data, `${path}.${period}.data`),
					`${path}.${period}`,
					/^[ENSW]\d{8}$/,
				),
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	if (periods.length === 0)
		throw new Error(`${path} has no population periods`);
	const expectedCodes = periods[0]?.records
		.map((record) => record.areaCode)
		.join(",");
	if (
		periods.some(
			(period) =>
				period.records.map((record) => record.areaCode).join(",") !==
				expectedCodes,
		)
	) {
		throw new Error(
			`${path}: local-authority codes change between periods`,
		);
	}
	return periods;
};

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
	const population = datasets.find((dataset) => dataset.id === "population");
	if (!population)
		throw new Error(`${manifestPath} has no population dataset`);
	const populationUk = datasets.find(
		(dataset) => dataset.id === "population-uk",
	);
	if (!populationUk)
		throw new Error(`${manifestPath} has no population-uk dataset`);
	const records = populationRecords(populationPath);
	if (records.length !== population.summary.dataRecordCount) {
		throw new Error(
			`${populationPath}: expected ${population.summary.dataRecordCount} records from the manifest, found ${records.length}`,
		);
	}
	if (
		population.summary.boundaryYears.length !== 1 ||
		population.summary.boundaryYears[0] !== 2023
	) {
		throw new Error(
			`${manifestPath}: population must declare boundary year 2023`,
		);
	}
	const countries = countriesFor(records);
	// ONS's own constituency estimates, one partition per mid-year.
	const constituencyPeriods = Object.entries(
		JSON.parse(
			readFileSync(populationConstituencyPath, "utf8"),
		) as PopulationFile,
	)
		.map(([period, value]) => {
			const entry = object(
				value,
				`${populationConstituencyPath}.${period}`,
			);
			if (
				!/^\d{4}$/.test(period) ||
				entry.year !== Number(period) ||
				entry.boundaryType !== "constituency" ||
				entry.boundaryYear !== 2024
			) {
				throw new Error(
					`${populationConstituencyPath}.${period}: expected constituency data on the 2024 code vintage`,
				);
			}
			const data = object(
				entry.data,
				`${populationConstituencyPath}.${period}.data`,
			);
			return {
				period,
				records: Object.entries(data)
					.map(([areaCode, record]) => {
						if (!/^(E14|W07)\d{6}$/.test(areaCode))
							throw new Error(
								`${populationConstituencyPath}: unsupported constituency code ${areaCode}`,
							);
						return {
							areaCode,
							value: number(
								object(
									record,
									`${populationConstituencyPath}.${period}.${areaCode}`,
								).total,
								`${populationConstituencyPath}.${period}.${areaCode}.total`,
							),
							status: "observed" as const,
						};
					})
					.sort((left, right) =>
						left.areaCode.localeCompare(right.areaCode),
					),
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	const constituencyDataset = datasets.find(
		(dataset) => dataset.id === "population-constituency",
	);
	if (!constituencyDataset)
		throw new Error(
			`${manifestPath} has no population-constituency dataset`,
		);
	const constituencyRecordCount = constituencyPeriods.reduce(
		(total, period) => total + period.records.length,
		0,
	);
	if (
		constituencyRecordCount !== constituencyDataset.summary.dataRecordCount
	) {
		throw new Error(
			`${populationConstituencyPath}: expected ${constituencyDataset.summary.dataRecordCount} records from the manifest, found ${constituencyRecordCount}`,
		);
	}
	const constituencyContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "population-estimate",
		sourceGeography: { type: "constituency", boundaryYear: 2024 },
		periods: constituencyPeriods,
	});
	const localAuthorityPeriods =
		localAuthorityPopulationRecords(populationUkPath);
	const localAuthorityRecords = localAuthorityPeriods.flatMap(
		(period) => period.records,
	);
	if (localAuthorityRecords.length !== populationUk.summary.dataRecordCount) {
		throw new Error(
			`${populationUkPath}: expected ${populationUk.summary.dataRecordCount} records from the manifest, found ${localAuthorityRecords.length}`,
		);
	}
	if (localAuthorityPeriods.length !== populationUk.summary.datasetCount) {
		throw new Error(
			`${populationUkPath}: expected ${populationUk.summary.datasetCount} periods from the manifest, found ${localAuthorityPeriods.length}`,
		);
	}
	if (
		populationUk.summary.boundaryYears.length !== 1 ||
		populationUk.summary.boundaryYears[0] !== 2023
	) {
		throw new Error(
			`${manifestPath}: population-uk must declare boundary year 2023`,
		);
	}
	const populationCodes = new Set(
		localAuthorityPeriods[0]?.records.map((record) => record.areaCode),
	);
	const emissions = datasets.find(
		(dataset) => dataset.id === "ghg-emissions",
	);
	if (!emissions)
		throw new Error(`${manifestPath} has no ghg-emissions dataset`);
	const emissionsPeriods = localAuthorityFieldPeriods(
		ghgEmissionsPath,
		"totalKtCO2e",
		2025,
	);
	const emissionsRecordCount = emissionsPeriods.reduce(
		(total, period) => total + period.records.length,
		0,
	);
	if (emissionsRecordCount !== emissions.summary.dataRecordCount) {
		throw new Error(
			`${ghgEmissionsPath}: expected ${emissions.summary.dataRecordCount} records from the manifest, found ${emissionsRecordCount}`,
		);
	}
	if (emissionsPeriods.length !== emissions.summary.datasetCount) {
		throw new Error(
			`${ghgEmissionsPath}: expected ${emissions.summary.datasetCount} periods from the manifest, found ${emissionsPeriods.length}`,
		);
	}
	if (
		emissions.summary.boundaryYears.length !== 1 ||
		emissions.summary.boundaryYears[0] !== 2025
	) {
		throw new Error(
			`${manifestPath}: ghg-emissions must declare boundary year 2025`,
		);
	}
	const emissionsMeasure: Measure = {
		id: "ghg-emissions",
		label: "Greenhouse gas emissions",
		valueKind: "quantity",
		unit: "kt CO2e",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		sources: [
			{
				datasetId: "ghg-emissions",
				periods: emissionsPeriods.map((period) => period.period),
				sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
				coverage: {
					kind: "source-reported",
					countries: countriesFor(emissionsPeriods[0]?.records ?? []),
					recordCount: emissionsPeriods[0]?.records.length ?? 0,
					note: "Published source records cover all four UK nations for every available period, restated on one code vintage by the publisher.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: true,
		},
		links: { data: "/v1/data/ghg-emissions" },
		notes: [
			"Values are net territorial emissions across every sector and gas. Land use, land use change and forestry is a net sink in most rural authorities, so their totals are lower than their gross emissions. No published authority-year is negative, but nothing in the method prevents it.",
			"Emissions per resident are not served. They are a ratio, and a ratio cannot be summed over areas or compared between authorities of different size without recomputing it from the underlying totals.",
			"Local authority totals exclude sources the publisher cannot attribute to an area, such as aviation and shipping, so they do not sum to the national inventory.",
		],
	};
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
		localAuthorityPeriods,
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
	const measure: Measure = {
		id: "population-estimate",
		label: "Population estimate",
		valueKind: "count",
		unit: "people",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		sources: [
			{
				datasetId: "population",
				periods: ["2022"],
				sourceGeography: { type: "ward", boundaryYear: 2023 },
				coverage: {
					kind: "partial",
					countries,
					recordCount: records.length,
					note: "Published source records are available for England and Wales only; this endpoint does not infer Scottish or Northern Irish values.",
				},
			},
			{
				datasetId: "population-uk",
				periods: localAuthorityPeriods.map((period) => period.period),
				sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
				coverage: {
					kind: "source-reported",
					countries: countriesFor(
						localAuthorityPeriods[0]?.records ?? [],
					),
					recordCount: localAuthorityPeriods[0]?.records.length ?? 0,
					note: "Published source records cover all four UK nations for every available period. Historic values remain keyed to the source's 2023 local-authority code vintage.",
				},
			},
			{
				datasetId: "population-constituency",
				periods: constituencyPeriods.map((period) => period.period),
				sourceGeography: { type: "constituency", boundaryYear: 2024 },
				coverage: {
					kind: "partial",
					countries: countriesFor(
						constituencyPeriods[0]?.records ?? [],
					),
					recordCount: constituencyPeriods[0]?.records.length ?? 0,
					note: "Published by ONS for the constituencies first contested in July 2024, in England and Wales only. These are ONS's own estimates for each constituency, not ward estimates added up: wards do not nest within these constituencies, and the published ward lookup splits some wards between them without weights.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: true,
		},
		links: { data: "/v1/data/population-estimate" },
	};
	const catalogContent = JSON.stringify({
		schemaVersion: 1,
		source: {
			artifact: "data/precompiled/dataset-manifest.json",
			manifestVersion: manifest.version,
		},
		datasets,
		measures: [
			measure,
			...elections.measures,
			density.measure,
			housePrice.measure,
			...deprivation.measures,
			nimdm.measure,
			...lifeExpectancy.measures,
			emissionsMeasure,
			jobs.measure,
			...mobileCoverage.measures,
			...indicatorMeasures,
			...unemployment.measures,
			...census.measures,
		],
	});
	const emissionsObservationsContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "ghg-emissions",
		sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
		periods: emissionsPeriods,
	});
	const observationsContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "population-estimate",
		period: "2022",
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		records,
	});
	const localAuthorityObservationsContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "population-estimate",
		sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		periods: localAuthorityPeriods,
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
				measure,
				...elections.measures,
				density.measure,
				housePrice.measure,
				...deprivation.measures,
				nimdm.measure,
				...lifeExpectancy.measures,
				emissionsMeasure,
				jobs.measure,
				...mobileCoverage.measures,
				...indicatorMeasures,
				...unemployment.measures,
				...census.measures,
			],
		},
		populationConstituencyObservations: {
			schemaVersion: 1,
			contentHash: sha256(constituencyContent),
			measureId: "population-estimate",
			sourceGeography: { type: "constituency", boundaryYear: 2024 },
			periods: constituencyPeriods,
		},
		populationObservations: {
			schemaVersion: 1,
			contentHash: sha256(observationsContent),
			measureId: "population-estimate",
			period: "2022",
			sourceGeography: { type: "ward", boundaryYear: 2023 },
			records,
		},
		populationLocalAuthorityObservations: {
			schemaVersion: 1,
			contentHash: sha256(localAuthorityObservationsContent),
			measureId: "population-estimate",
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			periods: localAuthorityPeriods,
		},
		ghgEmissionsObservations: {
			schemaVersion: 1,
			contentHash: sha256(emissionsObservationsContent),
			measureId: "ghg-emissions",
			sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
			periods: emissionsPeriods,
		},
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
