import { readFileSync } from "node:fs";
import type {
	Country,
	MeasureSource,
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
import { countryForCode, countriesFor } from "./countries";
import { localAuthorityFieldPeriods } from "./localAuthorityFields";
import {
	APRIL_2023_LAD_MERGERS,
	APRIL_2020_2021_LAD_MERGERS,
	RECODED_2025,
	onApril2023Authorities,
} from "./authorityChanges";
import { compileElections } from "./elections";
import { compileNimdm } from "./nimdm";
import { compileHousePrice } from "./housePrice";
import { compileLifeExpectancy } from "./lifeExpectancy";
import { compileDeprivationIndices } from "./deprivation";
import { compilePopulationDensity } from "./populationDensity";
import {
	type Indicator,
	mergeMeasurePartitions,
	publishIndicators,
} from "./indicators";
import { compileBroadband } from "./broadband";
import { compileClaimantCount } from "./claimantCount";
import { compileHomelessness } from "./homelessness";
import { compileRoadCollisions } from "./roadCollisions";
import { compileIncome } from "./income";
import { compileCrime } from "./crime";

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
	/**
	 * Total jobs, counted where the work is.
	 *
	 * Great Britain is published for every year and Northern Ireland only for
	 * 2020 to 2022, so a period's record count depends on the year. That
	 * absence is checked here to be whole nations and nothing else: a British
	 * district missing from one year, or part of Northern Ireland, would be a
	 * gap the coverage note does not describe, and the build refuses it.
	 */
	const jobs = datasets.find((dataset) => dataset.id === "jobs");
	if (!jobs) throw new Error(`${manifestPath} has no jobs dataset`);
	if (
		jobs.summary.boundaryYears.length !== 1 ||
		jobs.summary.boundaryYears[0] !== 2023
	) {
		throw new Error(
			`${manifestPath}: jobs must declare boundary year 2023`,
		);
	}
	const jobsPeriods = localAuthorityFieldPeriods(jobsPath, "totalJobs", 2023);
	const jobsRecordCount = jobsPeriods.reduce(
		(total, period) => total + period.records.length,
		0,
	);
	if (jobsRecordCount !== jobs.summary.dataRecordCount) {
		throw new Error(
			`${jobsPath}: expected ${jobs.summary.dataRecordCount} records from the manifest, found ${jobsRecordCount}`,
		);
	}
	if (jobsPeriods.length !== jobs.summary.datasetCount) {
		throw new Error(
			`${jobsPath}: expected ${jobs.summary.datasetCount} periods from the manifest, found ${jobsPeriods.length}`,
		);
	}
	const populationCodes = new Set(
		localAuthorityPeriods[0]?.records.map((record) => record.areaCode),
	);
	const codesIn = (period: (typeof jobsPeriods)[number], country: Country) =>
		period.records
			.map((record) => record.areaCode)
			.filter((code) => countryForCode(code) === country)
			.join(",");
	for (const country of ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"] as const) {
		const expected = [...populationCodes]
			.filter((code) => countryForCode(code) === country)
			.sort((left, right) => left.localeCompare(right))
			.join(",");
		for (const period of jobsPeriods) {
			const published = codesIn(period, country);
			if (published === expected) continue;
			if (country === "GB-NIR" && published === "") continue;
			throw new Error(
				`${jobsPath}.${period.period}: ${country} districts do not match the 2023 local-authority code set, so the gap is not a whole nation`,
			);
		}
	}
	const jobsCountries = countriesFor(
		jobsPeriods.flatMap((period) => period.records),
	);
	const northernIrelandPeriods = jobsPeriods
		.filter((period) => codesIn(period, "GB-NIR") !== "")
		.map((period) => period.period);
	const jobsContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "total-jobs",
		sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		periods: jobsPeriods,
	});
	const jobsMeasure: Measure = {
		id: "total-jobs",
		label: "Total jobs",
		valueKind: "count",
		unit: "jobs",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		sources: [
			{
				datasetId: "jobs",
				periods: jobsPeriods.map((period) => period.period),
				sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
				coverage: {
					kind: "partial",
					countries: jobsCountries,
					recordCount: jobsPeriods.at(-1)?.records.length ?? 0,
					note: `Great Britain is published for every period. Northern Ireland is published for ${northernIrelandPeriods.join(", ")} only, and has no records in the other periods rather than zero jobs, so the record count varies by period; the count here is the latest period's.`,
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: true,
		},
		links: { data: "/v1/data/total-jobs" },
		notes: [
			"Jobs located in the authority, counted at the workplace rather than where the worker lives: employee jobs, self-employment jobs, government-supported trainees and HM Forces. A person with two jobs counts twice, and a job held by a commuter counts where it is done.",
			"Each value is rounded by the publisher to the nearest thousand. A sum over areas carries that rounding from every member, so it can differ from a published total for the same place by several thousand.",
			"The publisher restates the whole series on April 2023 district codes with each release, so every period shares one code vintage and no conversion was applied.",
			"Jobs density, jobs per resident aged 16 to 64, is published alongside this series but is not served: it is a ratio and would need the working-age population as a weight to combine over areas.",
		],
	};
	const mobile = datasets.find((dataset) => dataset.id === "mobile-coverage");
	if (!mobile)
		throw new Error(`${manifestPath} has no mobile-coverage dataset`);
	if (
		mobile.summary.boundaryYears.length !== 1 ||
		mobile.summary.boundaryYears[0] !== 2024
	) {
		throw new Error(
			`${manifestPath}: mobile-coverage must declare boundary year 2024`,
		);
	}
	/**
	 * Two of the six published coverage metrics.
	 *
	 * The "at least one operator" variants sit between 94% and 100% for indoor
	 * 4G and are nearly saturated, so they distinguish almost nothing; the
	 * landmass variants use a different denominator and so cannot be weighted
	 * by premises the way the aggregation contract below declares. Both remain
	 * in the compiled dataset for anyone reading it directly.
	 */
	const mobileMetrics = [
		{
			id: "mobile-4g-coverage",
			label: "4G mobile coverage",
			field: "pct4GIndoorAll",
			note: "Premises with an indoor 4G signal from all four mobile network operators. Indoor coverage is modelled by the publisher, not measured at each premises.",
		},
		{
			id: "mobile-5g-coverage",
			label: "5G mobile coverage",
			field: "pct5GOutdoorAll",
			note: "Premises with an outdoor 5G signal from all four mobile network operators, at the publisher's high-confidence threshold. 5G is reported outdoors only.",
		},
	] as const;
	const mobileObservations = mobileMetrics.map((metric) => {
		const periods = localAuthorityFieldPeriods(
			mobileCoveragePath,
			metric.field,
			2024,
		);
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId: metric.id,
			sourceGeography: { type: "localAuthority", boundaryYear: 2024 },
			periods,
		});
		return {
			metric,
			artifact: {
				schemaVersion: 1 as const,
				contentHash: sha256(content),
				measureId: metric.id,
				sourceGeography: {
					type: "localAuthority" as const,
					boundaryYear: 2024,
				},
				periods,
			},
		};
	});
	const mobileMeasures: Measure[] = mobileObservations.map(
		({ metric, artifact }) => ({
			id: metric.id,
			label: metric.label,
			valueKind: "ratio",
			unit: "% of premises",
			aggregation: {
				kind: "intensive",
				operation: "weighted-mean",
				weight: {
					description:
						"The authority's premises count, which the published coverage percentages are computed against.",
					datasetField: "premisesCount",
				},
				available: false,
			},
			sources: [
				{
					datasetId: "mobile-coverage",
					periods: artifact.periods.map((period) => period.period),
					sourceGeography: {
						type: "localAuthority",
						boundaryYear: 2024,
					},
					coverage: {
						kind: "source-reported",
						countries: countriesFor(
							artifact.periods[0]?.records ?? [],
						),
						recordCount: artifact.periods[0]?.records.length ?? 0,
						note: "Published source records cover all four UK nations for the single available period.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: false,
			},
			links: { data: `/v1/data/${metric.id}` },
			notes: [
				metric.note,
				"This is a share of premises, so it does not add over areas. Combining authorities needs a premises-weighted mean, and the weight is not served here; averaging the percentages flat would weigh the Isles of Scilly as heavily as Birmingham.",
			],
		}),
	);
	/**
	 * The census breakdowns, published as counts rather than shares.
	 *
	 * A count of people or households is extensive, so it adds over areas and
	 * needs no weight. Publishing the categories and their denominator lets a
	 * caller derive any share they want and know exactly what it is a share
	 * of, which is safer than the API dividing for them and leaving the
	 * universe implicit.
	 */
	const censusBreakdowns = [
		{
			datasetId: "travel-to-work",
			field: "breakdown",
			sourceBoundaryYear: 2025,
			unit: "people in employment",
			universe:
				"Usual residents aged 16 and over in employment in the week before the census. Those not in employment, and anyone aged under 16, are excluded.",
			categories: [
				["car", "car", "Travel to work by car or van"],
				["home", "workFromHome", "Work mainly at or from home"],
				[
					"public-transport",
					"publicTransport",
					"Travel to work by public transport",
				],
				["on-foot", "onFoot", "Travel to work on foot"],
				["bicycle", "bicycle", "Travel to work by bicycle"],
				["taxi", "taxi", "Travel to work by taxi"],
				["motorcycle", "motorcycle", "Travel to work by motorcycle"],
				["other", "other", "Travel to work by another method"],
				["total", "total", "People in employment"],
			],
			notes: [
				"Driving and being a passenger are one category here; the census counts them apart.",
				"Working mainly at or from home is a method of travel in the census, not an absence of one.",
			],
		},
		{
			datasetId: "car-availability",
			field: "breakdown",
			sourceBoundaryYear: 2025,
			unit: "households",
			universe:
				"Households, not people. A household with four residents and one car counts once.",
			categories: [
				["none", "noCar", "Households with no car or van"],
				["one", "oneCar", "Households with one car or van"],
				["two", "twoCars", "Households with two cars or vans"],
				[
					"three-or-more",
					"threeOrMoreCars",
					"Households with three or more cars or vans",
				],
				["total", "total", "Households"],
			],
			notes: [
				"The top category is open-ended, so the table gives no count of vehicles.",
			],
		},
		{
			datasetId: "qualification",
			field: "breakdown",
			sourceBoundaryYear: 2025,
			unit: "usual residents aged 16 and over",
			universe:
				"Usual residents aged 16 and over. Residents under 16, whom the table records as 'Does not apply', are excluded.",
			categories: [
				["none", "noQualifications", "No qualifications"],
				[
					"level-1",
					"level1",
					"Highest qualification: level 1 and entry level",
				],
				["level-2", "level2", "Highest qualification: level 2"],
				[
					"apprenticeship",
					"apprenticeship",
					"Highest qualification: apprenticeship",
				],
				["level-3", "level3", "Highest qualification: level 3"],
				[
					"level-4-plus",
					"level4Plus",
					"Highest qualification: level 4 or above",
				],
				["other", "other", "Highest qualification: other"],
				["total", "total", "Usual residents aged 16 and over"],
			],
			notes: [
				"Each resident is counted once, at their highest qualification. Level 4 or above includes degrees and higher degrees; level 3 includes two or more A levels.",
				"Apprenticeship is its own category, whatever level the apprenticeship was.",
				"Other covers vocational or work-related qualifications, and qualifications achieved outside England or Wales whose level is not stated or known.",
			],
		},
		{
			datasetId: "ethnicity",
			field: "",
			sourceBoundaryYear: 2024,
			unit: "usual residents",
			universe:
				"All usual residents, as they identified themselves. The nineteen categories are exhaustive, so they sum to the whole resident population.",
			categories: [
				[
					"bangladeshi",
					"Asian, Asian British or Asian Welsh.Bangladeshi.population",
					"Ethnic group: Bangladeshi",
				],
				[
					"chinese",
					"Asian, Asian British or Asian Welsh.Chinese.population",
					"Ethnic group: Chinese",
				],
				[
					"indian",
					"Asian, Asian British or Asian Welsh.Indian.population",
					"Ethnic group: Indian",
				],
				[
					"pakistani",
					"Asian, Asian British or Asian Welsh.Pakistani.population",
					"Ethnic group: Pakistani",
				],
				[
					"other-asian",
					"Asian, Asian British or Asian Welsh.Other Asian.population",
					"Ethnic group: Other Asian",
				],
				[
					"african",
					"Black, Black British, Black Welsh, Caribbean or African.African.population",
					"Ethnic group: African",
				],
				[
					"caribbean",
					"Black, Black British, Black Welsh, Caribbean or African.Caribbean.population",
					"Ethnic group: Caribbean",
				],
				[
					"other-black",
					"Black, Black British, Black Welsh, Caribbean or African.Other Black.population",
					"Ethnic group: Other Black",
				],
				[
					"white-and-asian",
					"Mixed or Multiple ethnic groups.White and Asian.population",
					"Ethnic group: White and Asian",
				],
				[
					"white-and-black-african",
					"Mixed or Multiple ethnic groups.White and Black African.population",
					"Ethnic group: White and Black African",
				],
				[
					"white-and-black-caribbean",
					"Mixed or Multiple ethnic groups.White and Black Caribbean.population",
					"Ethnic group: White and Black Caribbean",
				],
				[
					"other-mixed",
					"Mixed or Multiple ethnic groups.Other Mixed or Multiple ethnic groups.population",
					"Ethnic group: Other Mixed or Multiple ethnic groups",
				],
				[
					"white-british",
					"White.English, Welsh, Scottish, Northern Irish or British.population",
					"Ethnic group: English, Welsh, Scottish, Northern Irish or British",
				],
				["irish", "White.Irish.population", "Ethnic group: Irish"],
				[
					"gypsy-or-irish-traveller",
					"White.Gypsy or Irish Traveller.population",
					"Ethnic group: Gypsy or Irish Traveller",
				],
				["roma", "White.Roma.population", "Ethnic group: Roma"],
				[
					"other-white",
					"White.Other White.population",
					"Ethnic group: Other White",
				],
				[
					"arab",
					"Other ethnic group.Arab.population",
					"Ethnic group: Arab",
				],
				[
					"any-other",
					"Other ethnic group.Any other ethnic group.population",
					"Ethnic group: Any other ethnic group",
				],
			],
			notes: [
				"The census's five high-level groups are not served separately; each is the sum of its categories, which is exact for a count.",
				"ONS perturbs census cell counts to protect confidentiality, so a sum of these categories can differ by a few residents from a population total published in another table.",
				'The White category "English, Welsh, Scottish, Northern Irish or British" is one census tick-box, not a statement about nationality.',
			],
		},
	] as const;

	const censusPaths = {
		"travel-to-work": travelToWorkPath,
		"car-availability": carAvailabilityPath,
		qualification: qualificationPath,
		ethnicity: ethnicityPath,
	};
	const CENSUS_BOUNDARY_YEAR = 2023;
	const englandAndWales2023 = [...populationCodes].filter(
		(code) => code.startsWith("E") || code.startsWith("W"),
	);
	const censusObservations = censusBreakdowns.flatMap((breakdown) => {
		const dataset = datasets.find(
			(candidate) => candidate.id === breakdown.datasetId,
		);
		if (!dataset)
			throw new Error(
				`${manifestPath} has no ${breakdown.datasetId} dataset`,
			);
		if (
			dataset.summary.boundaryYears.length !== 1 ||
			dataset.summary.boundaryYears[0] !== breakdown.sourceBoundaryYear
		) {
			throw new Error(
				`${manifestPath}: ${breakdown.datasetId} must declare boundary year ${breakdown.sourceBoundaryYear}`,
			);
		}
		const path = censusPaths[breakdown.datasetId];
		return breakdown.categories.map(([suffix, field, label]) => {
			const measureId = `${breakdown.datasetId}-${suffix}`;
			const periods = localAuthorityFieldPeriods(
				path,
				breakdown.field ? `${breakdown.field}.${field}` : field,
				breakdown.sourceBoundaryYear,
			).map((period) => {
				try {
					return onApril2023Authorities(period, englandAndWales2023);
				} catch (error) {
					throw new Error(
						`${path}: ${measureId} ${period.period}: ${(error as Error).message}`,
					);
				}
			});
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId,
				sourceGeography: {
					type: "localAuthority",
					boundaryYear: CENSUS_BOUNDARY_YEAR,
				},
				periods,
			});
			return {
				measure: {
					id: measureId,
					label,
					valueKind: "count",
					unit: breakdown.unit,
					aggregation: {
						kind: "extensive",
						operation: "sum",
						available: true,
					},
					sources: [
						{
							datasetId: breakdown.datasetId,
							periods: periods.map((period) => period.period),
							sourceGeography: {
								type: "localAuthority",
								boundaryYear: CENSUS_BOUNDARY_YEAR,
							},
							coverage: {
								kind: "partial",
								countries: countriesFor(
									periods[0]?.records ?? [],
								),
								recordCount: periods[0]?.records.length ?? 0,
								note: "Published source records cover England and Wales only; this endpoint does not infer Scottish or Northern Irish values.",
							},
						},
					],
					availability: {
						sourceExact: true,
						conversion: false,
						aggregation: true,
					},
					links: { data: `/v1/data/${measureId}` },
					notes: [
						breakdown.universe,
						...breakdown.notes,
						"The census reports on 2021 boundaries. The four authorities created in April 2023 are compiled by summing their predecessors, which is exact for a count, and the districts they replaced are not served, so no resident is counted twice. The partition is on April 2023 codes, which Barnsley and Sheffield changed in 2025.",
					],
				} satisfies Measure,
				artifact: {
					schemaVersion: 1 as const,
					contentHash: sha256(content),
					measureId,
					sourceGeography: {
						type: "localAuthority" as const,
						boundaryYear: CENSUS_BOUNDARY_YEAR,
					},
					periods,
				},
			};
		});
	});
	const censusMeasures = censusObservations.map(({ measure }) => measure);

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
	/**
	 * ONS's final model-based unemployment estimates, in the two code vintages
	 * the workbook itself holds.
	 *
	 * The model estimated every district from 1996, and separately estimated
	 * Buckinghamshire from 2016 and the two Northamptonshire authorities from
	 * 2020, so for those years the workbook holds both the districts and the
	 * authorities that replaced them. Serving both in one partition would count
	 * the same residents twice. So the districts form an April 2019 partition
	 * over every period, and the replacement authorities an April 2021
	 * partition over the years all three are estimated. The four authorities
	 * of April 2023 were never estimated; the compiled dataset builds them from
	 * their districts, and those derived records are not served.
	 */
	const unemploymentFile = JSON.parse(
		readFileSync(unemploymentPath, "utf8"),
	) as Record<
		string,
		{
			periodLabels?: Record<string, string>;
			data?: Record<
				string,
				{
					rates?: Record<string, number | null>;
					rateIntervals?: Record<string, number | null>;
					levels?: Record<string, number | null>;
					levelIntervals?: Record<string, number | null>;
					derivedFromPredecessors?: string[];
				}
			>;
		}
	>;
	const unemploymentDataset = datasets.find(
		(candidate) => candidate.id === "unemployment",
	);
	if (!unemploymentDataset)
		throw new Error(`${manifestPath} has no unemployment dataset`);
	const [unemploymentEdition, ...laterEditions] =
		Object.values(unemploymentFile);
	if (
		!unemploymentEdition?.data ||
		!unemploymentEdition.periodLabels ||
		laterEditions.length > 0
	)
		throw new Error(
			`${unemploymentPath}: expected one edition with its period labels`,
		);
	const unemploymentData = unemploymentEdition.data;
	/** "April 1996 to March 1997" as 1996-97, "January to December 2004" as 2004. */
	const unemploymentPeriods = Object.entries(
		unemploymentEdition.periodLabels,
	).map(([key, label]) => {
		const financial = /^April (\d{4}) to March (\d{4})$/.exec(label);
		const calendar = /^January to December (\d{4})$/.exec(label);
		if (financial && Number(financial[2]) === Number(financial[1]) + 1)
			return { key, period: `${financial[1]}-${financial[2].slice(2)}` };
		if (calendar && calendar[1] === key) return { key, period: key };
		throw new Error(`${unemploymentPath}: unrecognised period ${label}`);
	});
	const notModelled = new Set(["E09000001", "E06000053"]);
	const greatBritain2021 = [
		...[...populationCodes].filter(
			(code) =>
				!code.startsWith("N") && !(code in APRIL_2023_LAD_MERGERS),
		),
		...Object.values(APRIL_2023_LAD_MERGERS).flat(),
	].filter((code) => !notModelled.has(code));
	const greatBritain2019 = [
		...greatBritain2021.filter(
			(code) => !(code in APRIL_2020_2021_LAD_MERGERS),
		),
		...Object.values(APRIL_2020_2021_LAD_MERGERS).flat(),
	];
	const derivedCodes = Object.entries(unemploymentData)
		.filter(([, record]) => record.derivedFromPredecessors)
		.map(([code]) => code)
		.sort();
	if (
		derivedCodes.join() !==
		Object.keys(APRIL_2023_LAD_MERGERS).sort().join()
	)
		throw new Error(
			`${unemploymentPath}: only the April 2023 authorities may be derived, found ${derivedCodes.join(", ")}`,
		);
	const published = Object.keys(unemploymentData)
		.filter((code) => !derivedCodes.includes(code))
		.sort();
	const expectedPublished = [
		...new Set([...greatBritain2019, ...greatBritain2021]),
	].sort();
	if (published.join() !== expectedPublished.join())
		throw new Error(
			`${unemploymentPath}: estimated authorities are not exactly the April 2019 and April 2021 Great Britain code sets`,
		);
	const round1 = (value: number) => Number(value.toFixed(1));
	const unemploymentPartition = (
		measureId: string,
		valueField: "rates" | "levels",
		intervalField: "rateIntervals" | "levelIntervals",
		boundaryYear: 2019 | 2021,
	) => {
		const codes =
			boundaryYear === 2019 ? greatBritain2019 : greatBritain2021;
		const periods = unemploymentPeriods
			.map(({ key, period }) => ({
				period,
				records: codes
					.flatMap((areaCode): PopulationObservation[] => {
						const value =
							unemploymentData[areaCode]?.[valueField]?.[key];
						if (value === null || value === undefined) return [];
						const halfWidth =
							unemploymentData[areaCode]?.[intervalField]?.[key];
						return [
							{
								areaCode,
								value,
								status: "observed",
								...(halfWidth === null ||
								halfWidth === undefined
									? {}
									: {
											confidenceInterval: {
												lower: round1(
													value - halfWidth,
												),
												upper: round1(
													value + halfWidth,
												),
											},
										}),
							},
						];
					})
					.sort((left, right) =>
						left.areaCode.localeCompare(right.areaCode),
					),
			}))
			// The 2021 partition holds only years every one of its authorities
			// is estimated; the districts' partition holds every year.
			.filter((period) =>
				boundaryYear === 2019
					? period.records.length > 0
					: period.records.length === codes.length,
			)
			.sort((left, right) => left.period.localeCompare(right.period));
		const observationArtifact = `${measureId}-localAuthority-${boundaryYear}-observations`;
		const sourceGeography = {
			type: "localAuthority" as const,
			boundaryYear,
		};
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId,
			sourceGeography,
			periods,
		});
		const latest = periods.at(-1);
		return {
			source: {
				datasetId: "unemployment",
				periods: periods.map((period) => period.period),
				sourceGeography,
				observationArtifact,
				coverage: {
					kind: "partial" as const,
					countries: countriesFor(latest?.records ?? []),
					recordCount: latest?.records.length ?? 0,
					note:
						boundaryYear === 2019
							? "Great Britain's local authorities as they stood in April 2019, for every period from April 1996 to March 1997 to 2021. The City of London and the Isles of Scilly were never estimated, and an authority has no value for a period before the model covered it; the count here is the latest period's."
							: "Great Britain's local authorities as they stood in April 2021, for 2020 and 2021, the years the model estimated Buckinghamshire and North and West Northamptonshire alongside every other authority. The City of London and the Isles of Scilly were never estimated.",
				},
			} satisfies MeasureSource,
			artifact: {
				schemaVersion: 1 as const,
				contentHash: sha256(content),
				measureId,
				sourceGeography,
				periods,
			},
		};
	};
	const unemploymentNotes = [
		"ONS model-based estimates, combining Annual Population Survey unemployment with the claimant count averaged over twelve months. They are the final edition: ONS discontinued the series in August 2022, and current local estimates are published in its LI01 tables instead.",
		"Periods to 2003 are financial years, labelled like 1996-97; periods from 2004 are calendar years. Survey responses from January 2020 to March 2022 were reweighted by the publisher in June 2022.",
		"Buckinghamshire and the two Northamptonshire authorities are served only in the April 2021 partition, and the districts they replaced only in the April 2019 one, so no partition counts anyone twice. The model's estimate for a new authority is its own, and need not equal its districts' combined estimate.",
	];
	const unemploymentUncertainty = {
		kind: "confidence-interval" as const,
		level: 0.95,
		note: "The publisher's 95% confidence interval. The two Northamptonshire authorities and Buckinghamshire are published without one.",
	};
	const unemploymentMeasures: Measure[] = [];
	const unemploymentArtifacts: MeasureObservationArtifact[] = [];
	for (const spec of [
		{
			id: "unemployment-rate",
			label: "Unemployment rate",
			valueKind: "ratio" as const,
			unit: "% of economically active residents aged 16 and over",
			valueField: "rates" as const,
			intervalField: "rateIntervals" as const,
			aggregation: {
				kind: "intensive" as const,
				operation: "weighted-mean" as const,
				weight: {
					description:
						"Economically active residents aged 16 and over, which the publisher does not state but which is the level divided by the rate.",
					datasetField: "levels / rates",
				},
				available: false,
			},
			note: "Unemployed residents aged 16 and over as a share of the economically active: those in work or looking for it. A rate does not add over areas.",
		},
		{
			id: "unemployment-level",
			label: "Unemployed residents",
			valueKind: "count" as const,
			unit: "unemployed residents aged 16 and over",
			valueField: "levels" as const,
			intervalField: "levelIntervals" as const,
			aggregation: {
				kind: "extensive" as const,
				operation: "sum" as const,
				available: true,
			},
			note: "A sum of these modelled levels is itself an estimate. Its uncertainty is not the sum of its members' intervals, so no interval is given for a sum.",
		},
	]) {
		const partitions = ([2019, 2021] as const).map((boundaryYear) =>
			unemploymentPartition(
				spec.id,
				spec.valueField,
				spec.intervalField,
				boundaryYear,
			),
		);
		unemploymentMeasures.push({
			id: spec.id,
			label: spec.label,
			valueKind: spec.valueKind,
			unit: spec.unit,
			aggregation: spec.aggregation,
			sources: partitions.map(({ source }) => source),
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: spec.aggregation.available,
			},
			links: { data: `/v1/data/${spec.id}` },
			uncertainty: unemploymentUncertainty,
			notes: [spec.note, ...unemploymentNotes],
		});
		unemploymentArtifacts.push(
			...partitions.map(({ artifact }) => artifact),
		);
	}
	if (unemploymentDataset.summary.boundaryYears.join() !== "2024")
		throw new Error(
			`${manifestPath}: unemployment must declare boundary year 2024`,
		);
	const areaMean = (
		id: string,
		label: string,
		field: string,
		pollutant: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "quantity",
		unit: "µg/m³",
		status: "derived",
		aggregation: {
			kind: "intensive",
			operation: "weighted-mean",
			weight: {
				description:
					"The authority's count of 1x1 km grid cells, over which its mean is taken, so a weighted mean is the area mean over the combined authorities.",
				datasetField: "gridCells",
				measureId: "air-quality-grid-cells",
			},
			available: true,
		},
		notes: [
			`The mean of Defra's modelled 2024 annual mean background ${pollutant} concentration over the 1x1 km cells whose centres lie in the authority: an average across its area, not weighted by where people live.`,
		],
	});
	const populationWeightedPm25 = (
		id: string,
		label: string,
		field: string,
		note: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "quantity",
		unit: "µg/m³",
		aggregation: {
			kind: "intensive",
			operation: "weighted-mean",
			weight: {
				description:
					"The resident population Defra weighted each authority's concentrations by, which it does not publish with the table.",
				datasetField: "population",
			},
			available: false,
		},
		notes: [note],
	});
	/**
	 * Defra's Pollution Climate Mapping (PCM) model of background air
	 * pollution in 2024.
	 *
	 * The area means are compiled by the website's build from Defra's 1x1 km
	 * maps, so they are served as derived; each authority's count of cells is
	 * served beside them as the weight that combines them exactly. Defra's own
	 * population-weighted PM2.5 is served as published. Both are on the April
	 * 2023 authorities, which every 2024 release shares, and must name all 361.
	 */
	indicatorObservations.push(
		...publishIndicators(
			{ manifestPath, datasets },
			{
				datasetId: "air-quality",
				path: airQualityPath,
				boundaryYear: 2024,
				period: "2024",
				expectedCodes: [...populationCodes],
				coverageNote:
					"Every local authority in all four UK nations has a value.",
				notes: [
					"Background concentrations are modelled for 1x1 km squares away from the immediate influence of roads and industrial sources, so they are lower than roadside measurements.",
					"PCM maps from https://uk-air.defra.gov.uk/data/pcm-data. Each cell is assigned to the December 2024 authority containing its centre; a coastal cell whose centre lies offshore of the generalised coastline belongs to none.",
				],
				indicators: [
					{
						id: "air-quality-grid-cells",
						label: "PCM grid cells",
						field: "gridCells",
						valueKind: "count",
						unit: "1x1 km grid cells",
						status: "derived",
						aggregation: {
							kind: "extensive",
							operation: "sum",
							available: true,
						},
						notes: [
							"How many of Defra's 1x1 km PCM cells have their centre in the authority, roughly its land area in square kilometres. It is the weight for the area means.",
						],
					},
					areaMean(
						"no2-background-mean",
						"Background nitrogen dioxide, area mean",
						"no2Mean",
						"nitrogen dioxide (NO2)",
					),
					areaMean(
						"pm10-background-mean",
						"Background PM10, area mean",
						"pm10Mean",
						"PM10, in gravimetric units,",
					),
					areaMean(
						"pm25-background-mean",
						"Background PM2.5, area mean",
						"pm25Mean",
						"PM2.5",
					),
					populationWeightedPm25(
						"pm25-population-weighted",
						"Population-weighted PM2.5",
						"pm25PopulationWeighted",
						"Defra's published population-weighted annual mean PM2.5 for 2024, total of anthropogenic and non-anthropogenic, which Defra advises for estimating the health burden of long-term exposure.",
					),
					populationWeightedPm25(
						"pm25-population-weighted-anthropogenic",
						"Population-weighted anthropogenic PM2.5",
						"pm25PopulationWeightedAnthropogenic",
						"The anthropogenic part of Defra's population-weighted PM2.5 for 2024, excluding natural sources such as sea salt.",
					),
				],
			},
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
			jobsMeasure,
			...mobileMeasures,
			...indicatorMeasures,
			...unemploymentMeasures,
			...censusMeasures,
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
				jobsMeasure,
				...mobileMeasures,
				...indicatorMeasures,
				...unemploymentMeasures,
				...censusMeasures,
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
		jobsObservations: {
			schemaVersion: 1,
			contentHash: sha256(jobsContent),
			measureId: "total-jobs",
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			periods: jobsPeriods,
		},
		mobileCoverageObservations: mobileObservations.map(
			({ artifact }) => artifact,
		),
		censusObservations: censusObservations.map(({ artifact }) => artifact),
		indicatorObservations: [
			...indicatorObservations.map(({ artifact }) => artifact),
			...unemploymentArtifacts,
		],
		imdObservations: deprivation.artifacts,
		lifeExpectancyObservations: lifeExpectancy.artifacts,
		electionObservations: elections.artifacts,
		nimdmObservations: nimdm.artifact,
		housePriceObservations: housePrice.artifact,
		populationDensityObservations: density.artifact,
	};
};
