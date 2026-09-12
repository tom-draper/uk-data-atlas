import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

type DatasetManifest = {
	version?: unknown;
	datasets?: unknown;
};

type ManifestDataset = {
	output?: unknown;
	source?: unknown;
	inputs?: unknown;
	summary?: unknown;
	compiled?: unknown;
};

type PopulationFile = Record<string, unknown>;

type Source = {
	name?: unknown;
	source?: unknown;
	sourceUrl?: unknown;
	year?: unknown;
	licence?: unknown;
	licenceUrl?: unknown;
	description?: unknown;
};

type Input = {
	kind?: unknown;
	path?: unknown;
	bytes?: unknown;
	sha256?: unknown;
};

type Summary = {
	datasetCount?: unknown;
	dataRecordCount?: unknown;
	boundaryYears?: unknown;
};

type Compiled = {
	bytes?: unknown;
	sha256?: unknown;
};

export type DatasetCatalogueEntry = {
	id: string;
	label: string;
	publisher: string;
	sourceUrl: string;
	temporalCoverage: string;
	licence: { name: string; url?: string };
	description?: string;
	inputs: Array<{
		kind: string;
		path: string;
		bytes: number;
		sha256: string;
	}>;
	summary: {
		datasetCount: number;
		dataRecordCount: number;
		boundaryYears: number[];
	};
	compiled: { bytes: number; sha256: string };
};

export type Country = "GB-ENG" | "GB-NIR" | "GB-SCT" | "GB-WLS";

export type SourceGeography = {
	type: "ward" | "localAuthority";
	boundaryYear: number;
};

export type MeasureSource = {
	datasetId: string;
	periods: string[];
	sourceGeography: SourceGeography;
	coverage: {
		kind: "partial" | "source-reported";
		countries: Country[];
		recordCount: number;
		note: string;
	};
};

/**
 * How a measure may legitimately be combined over areas.
 *
 * The distinction is the one that stops an API from producing confident
 * nonsense. An extensive value adds: two authorities' tonnes of CO2e are a
 * region's tonnes. An intensive value does not: two authorities' coverage
 * percentages are not a region's coverage, and averaging them flat weighs a
 * thousand premises the same as half a million. `available` says whether the
 * API currently exposes the operation for the measure.
 */
export type MeasureAggregation =
	| { kind: "extensive"; operation: "sum"; available: boolean }
	| {
			kind: "intensive";
			operation: "weighted-mean";
			/** The denominator a caller has to weight by, and where to find it. */
			weight: { description: string; datasetField: string };
			available: false;
	  };

export type Measure = {
	id: string;
	label: string;
	valueKind: "count" | "quantity" | "ratio";
	unit: string;
	aggregation: MeasureAggregation;
	sources: MeasureSource[];
	availability: {
		sourceExact: true;
		conversion: false;
		aggregation: boolean;
	};
	links: { data: string };
	/** Anything a caller must know to read the values correctly. */
	notes?: string[];
};

/** @deprecated Use `MeasureSource`; kept so existing imports keep compiling. */
export type PopulationSource = MeasureSource;
/** @deprecated Use `Measure`. */
export type PopulationMeasure = Measure;

export type DataCatalog = {
	schemaVersion: 1;
	contentHash: string;
	source: {
		artifact: "data/precompiled/dataset-manifest.json";
		manifestVersion: number;
	};
	datasets: DatasetCatalogueEntry[];
	measures: Measure[];
};

export type PopulationObservation = {
	areaCode: string;
	value: number;
	status: "observed";
};

export type PopulationObservationArtifact = {
	schemaVersion: 1;
	contentHash: string;
	measureId: "population-estimate";
	period: "2022";
	sourceGeography: { type: "ward"; boundaryYear: 2023 };
	records: PopulationObservation[];
};

/**
 * A measure's observations, one block per period. The ward population artifact
 * predates this shape and carries a single period at the top level; everything
 * published since uses this.
 */
export type MeasureObservationArtifact = {
	schemaVersion: 1;
	contentHash: string;
	measureId: string;
	sourceGeography: SourceGeography;
	periods: Array<{ period: string; records: PopulationObservation[] }>;
};

export type PopulationLocalAuthorityObservationArtifact = {
	schemaVersion: 1;
	contentHash: string;
	measureId: "population-estimate";
	sourceGeography: { type: "localAuthority"; boundaryYear: 2023 };
	periods: Array<{ period: string; records: PopulationObservation[] }>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const string = (value: unknown, context: string): string => {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${context} must be a non-empty string`);
	}
	return value;
};

const number = (value: unknown, context: string): number => {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw new Error(`${context} must be a non-negative finite number`);
	}
	return value;
};

const object = (value: unknown, context: string): Record<string, unknown> => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${context} must be an object`);
	}
	return value as Record<string, unknown>;
};

const compileDataset = (
	value: unknown,
	index: number,
): DatasetCatalogueEntry => {
	const dataset = value as ManifestDataset;
	const id = string(dataset.output, `datasets[${index}].output`);
	const source = object(dataset.source, `${id}.source`) as Source;
	const inputs = dataset.inputs;
	const summary = object(dataset.summary, `${id}.summary`) as Summary;
	const compiled = object(dataset.compiled, `${id}.compiled`) as Compiled;
	if (!Array.isArray(inputs))
		throw new Error(`${id}.inputs must be an array`);
	if (!Array.isArray(summary.boundaryYears)) {
		throw new Error(`${id}.summary.boundaryYears must be an array`);
	}

	return {
		id,
		label: string(source.name, `${id}.source.name`),
		publisher: string(source.source, `${id}.source.source`),
		sourceUrl: string(source.sourceUrl, `${id}.source.sourceUrl`),
		temporalCoverage: string(source.year, `${id}.source.year`),
		licence: {
			name: string(source.licence, `${id}.source.licence`),
			...(typeof source.licenceUrl === "string" && source.licenceUrl
				? { url: source.licenceUrl }
				: {}),
		},
		...(typeof source.description === "string" && source.description
			? { description: source.description }
			: {}),
		inputs: inputs.map((input, inputIndex) => {
			const entry = object(input, `${id}.inputs[${inputIndex}]`) as Input;
			return {
				kind: string(entry.kind, `${id}.inputs[${inputIndex}].kind`),
				path: string(entry.path, `${id}.inputs[${inputIndex}].path`),
				bytes: number(entry.bytes, `${id}.inputs[${inputIndex}].bytes`),
				sha256: string(
					entry.sha256,
					`${id}.inputs[${inputIndex}].sha256`,
				),
			};
		}),
		summary: {
			datasetCount: number(
				summary.datasetCount,
				`${id}.summary.datasetCount`,
			),
			dataRecordCount: number(
				summary.dataRecordCount,
				`${id}.summary.dataRecordCount`,
			),
			boundaryYears: summary.boundaryYears.map((year, yearIndex) =>
				number(year, `${id}.summary.boundaryYears[${yearIndex}]`),
			),
		},
		compiled: {
			bytes: number(compiled.bytes, `${id}.compiled.bytes`),
			sha256: string(compiled.sha256, `${id}.compiled.sha256`),
		},
	};
};

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

const countryForCode = (code: string): Country => {
	const country = (
		{
			E: "GB-ENG",
			N: "GB-NIR",
			S: "GB-SCT",
			W: "GB-WLS",
		} as const
	)[code[0] as "E" | "N" | "S" | "W"];
	if (!country) throw new Error(`Unsupported country prefix in ${code}`);
	return country;
};

const countriesFor = (records: PopulationObservation[]): Country[] =>
	[
		...new Set(records.map((record) => countryForCode(record.areaCode))),
	].sort() as Country[];

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
 * Read compiled emissions as one observation per authority per year.
 *
 * The value is the net territorial total in kt CO2e across every sector and
 * gas, which is what the publisher reports and the only figure here that adds
 * over areas. Per-person intensity is deliberately not served: it is a ratio,
 * and summing or averaging it over a group of authorities would be wrong.
 */
const localAuthorityFieldPeriods = (
	path: string,
	field: string,
	boundaryYear: number,
): MeasureObservationArtifact["periods"] => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PopulationFile;
	const periods = Object.entries(source)
		.map(([period, value]) => {
			if (!/^\d{4}$/.test(period))
				throw new Error(`${path}: invalid period ${period}`);
			const entry = object(value, `${path}.${period}`);
			if (
				entry.year !== Number(period) ||
				entry.boundaryYear !== boundaryYear ||
				entry.boundaryType !== "localAuthority"
			) {
				throw new Error(
					`${path}.${period}: expected local-authority data on the ${boundaryYear} code vintage`,
				);
			}
			const data = object(entry.data, `${path}.${period}.data`);
			return {
				period,
				records: Object.entries(data)
					.map(([areaCode, record]) => {
						if (!/^[ENSW]\d{8}$/.test(areaCode)) {
							throw new Error(
								`${path}: unsupported area code ${areaCode}`,
							);
						}
						// A dotted field reaches into a nested breakdown,
						// which is how the census datasets are compiled.
						let observed: unknown = object(
							record,
							`${path}.${period}.${areaCode}`,
						);
						for (const segment of field.split(".")) {
							observed = object(
								observed,
								`${path}.${period}.${areaCode}`,
							)[segment];
						}
						// Not guarded by number(), which rejects negatives:
						// land use is a net sink in most rural authorities, and
						// nothing in the publisher's method stops one exceeding
						// the other sectors.
						if (
							typeof observed !== "number" ||
							!Number.isFinite(observed)
						) {
							throw new Error(
								`${path}.${period}.${areaCode}.${field} must be a finite number`,
							);
						}
						return {
							areaCode,
							value: observed,
							status: "observed" as const,
						};
					})
					.sort((left, right) =>
						left.areaCode.localeCompare(right.areaCode),
					),
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	if (periods.length === 0) throw new Error(`${path} has no periods`);
	return periods;
};

/**
 * Compile source-lineage metadata and one intentionally narrow, source-exact
 * population measure. It does not select a geometry release: the published
 * input records only declare the Ward 2023 code vintage, not a boundary month.
 */
export const compileDataCatalog = (
	manifestPath: string,
	populationPath: string,
	populationUkPath: string,
	ghgEmissionsPath: string,
	mobileCoveragePath: string,
	censusPaths: Record<"travel-to-work" | "car-availability", string>,
): {
	catalog: DataCatalog;
	populationObservations: PopulationObservationArtifact;
	populationLocalAuthorityObservations: PopulationLocalAuthorityObservationArtifact;
	ghgEmissionsObservations: MeasureObservationArtifact;
	mobileCoverageObservations: MeasureObservationArtifact[];
	censusObservations: MeasureObservationArtifact[];
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
	] as const;

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
			dataset.summary.boundaryYears[0] !== 2025
		) {
			throw new Error(
				`${manifestPath}: ${breakdown.datasetId} must declare boundary year 2025`,
			);
		}
		const path = censusPaths[breakdown.datasetId];
		return breakdown.categories.map(([suffix, field, label]) => {
			const measureId = `${breakdown.datasetId}-${suffix}`;
			const periods = localAuthorityFieldPeriods(
				path,
				`${breakdown.field}.${field}`,
				2025,
			);
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId,
				sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
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
								boundaryYear: 2025,
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
						"The census reports on 2021 boundaries. The four authorities created in April 2023 are compiled by summing their predecessors, which is exact for a count.",
					],
				} satisfies Measure,
				artifact: {
					schemaVersion: 1 as const,
					contentHash: sha256(content),
					measureId,
					sourceGeography: {
						type: "localAuthority" as const,
						boundaryYear: 2025,
					},
					periods,
				},
			};
		});
	});
	const censusMeasures = censusObservations.map(({ measure }) => measure);

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
			emissionsMeasure,
			...mobileMeasures,
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
				emissionsMeasure,
				...mobileMeasures,
				...censusMeasures,
			],
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
		mobileCoverageObservations: mobileObservations.map(
			({ artifact }) => artifact,
		),
		censusObservations: censusObservations.map(({ artifact }) => artifact),
	};
};
