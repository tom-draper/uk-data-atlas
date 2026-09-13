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
	/**
	 * The small-area geographies are the four nations' deprivation units, and
	 * they are not interchangeable: an English LSOA, a Scottish data zone and a
	 * Northern Irish super output area are drawn to different sizes and rules.
	 */
	type: "ward" | "localAuthority" | "lsoa" | "dataZone" | "superOutputArea";
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
	  }
	| {
			/**
			 * No operation recovers a combined value. A median of medians is not
			 * the median of the underlying sales, and no weight fixes that; the
			 * same is true of a rank or a decile. The statistic is named so a
			 * caller can see why rather than just that.
			 */
			kind: "non-aggregatable";
			statistic: "median" | "rank" | "decile";
			note: string;
			available: false;
	  };

export type Measure = {
	id: string;
	label: string;
	valueKind: "count" | "quantity" | "ratio" | "currency" | "ordinal";
	unit: string;
	aggregation: MeasureAggregation;
	sources: MeasureSource[];
	availability: {
		sourceExact: true;
		conversion: false;
		aggregation: boolean;
	};
	links: { data: string };
	/**
	 * Set when this measure is computed from others rather than published. The
	 * datasets named here are inputs to the computation and must be attributed
	 * alongside the measure's own sources.
	 */
	derivedFrom?: { datasetIds: string[]; note: string };
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
	/**
	 * `observed` is a value the publisher reported. `derived` is one this API
	 * computed from other measures, and no publisher is answerable for it.
	 */
	status: "observed" | "derived";
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

/**
 * Northern Ireland's super output areas predate the GSS scheme and keep their
 * NISRA codes, such as 95AA01S1: two digits for the region, two letters for
 * the former district, then a ward and a split suffix.
 */
const NI_SUPER_OUTPUT_AREA_CODE = /^95[A-Z]{2}\d{2}[A-Z]\d$/;

const isPublishedAreaCode = (code: string) =>
	/^[ENSW]\d{8}$/.test(code) || NI_SUPER_OUTPUT_AREA_CODE.test(code);

const countryForCode = (code: string): Country => {
	if (NI_SUPER_OUTPUT_AREA_CODE.test(code)) return "GB-NIR";
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
	geography: SourceGeography["type"] = "localAuthority",
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
				entry.boundaryType !== geography
			) {
				throw new Error(
					`${path}.${period}: expected ${geography} data on the ${boundaryYear} code vintage`,
				);
			}
			const data = object(entry.data, `${path}.${period}.data`);
			return {
				period,
				records: Object.entries(data)
					.map(([areaCode, record]) => {
						if (!isPublishedAreaCode(areaCode)) {
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
 * The house price partition, restored to the codes its publisher used.
 *
 * The website remaps Salford's twenty wards onto their 2021 codes so the map
 * joins to current boundaries, but those wards were redrawn in 2021: a price
 * measured on the old ward is not a price for the new one. The API reverses
 * the remap, so every value sits under the code it was published against.
 * Keep this in step with SALFORD_WARD_CODE_REMAP in
 * lib/data/house-price/loader.ts.
 */
const SALFORD_2021_CODE_TO_SOURCE_CODE: Record<string, string> = {
	E05013018: "E05000759",
	E05013020: "E05000760",
	E05013021: "E05000761",
	E05013022: "E05000762",
	E05013023: "E05000763",
	E05013024: "E05000764",
	E05013025: "E05000765",
	E05013019: "E05000766",
	E05013026: "E05000767",
	E05013030: "E05000768",
	E05013027: "E05000769",
	E05013028: "E05000770",
	E05013029: "E05000771",
	E05013032: "E05000772",
	E05013033: "E05000773",
	E05013034: "E05000774",
	E05013035: "E05000775",
	E05013036: "E05000776",
	E05013031: "E05000777",
	E05013037: "E05000778",
};

/**
 * The last period published for a full calendar year. The workbook is a
 * quarterly rolling series, and each year's figure here is the year ending
 * December; the final edition stops at the year ending March 2023, which is
 * not comparable and so is not published as a period.
 */
const LAST_DECEMBER_PERIOD = 2022;

const housePricePeriods = (
	path: string,
): MeasureObservationArtifact["periods"] => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PopulationFile;
	const edition = object(source["2023"], `${path}.2023`);
	if (edition.boundaryType !== "ward") {
		throw new Error(`${path}: expected ward-level house prices`);
	}
	const data = object(edition.data, `${path}.2023.data`);
	const byPeriod = new Map<string, PopulationObservation[]>();
	for (const [compiledCode, record] of Object.entries(data)) {
		const areaCode =
			SALFORD_2021_CODE_TO_SOURCE_CODE[compiledCode] ?? compiledCode;
		if (!/^[EW]\d{8}$/.test(areaCode)) {
			throw new Error(`${path}: unsupported ward code ${areaCode}`);
		}
		const prices = object(
			object(record, `${path}.${compiledCode}`).prices,
			`${path}.${compiledCode}.prices`,
		);
		for (const [year, price] of Object.entries(prices)) {
			if (!/^\d{4}$/.test(year) || Number(year) > LAST_DECEMBER_PERIOD)
				continue;
			const records = byPeriod.get(year) ?? [];
			records.push({
				areaCode,
				value: number(price, `${path}.${compiledCode}.prices.${year}`),
				status: "observed",
			});
			byPeriod.set(year, records);
		}
	}
	const periods = [...byPeriod.entries()]
		.map(([period, records]) => ({
			period,
			records: records.sort((left, right) =>
				left.areaCode.localeCompare(right.areaCode),
			),
		}))
		.sort((left, right) => left.period.localeCompare(right.period));
	if (periods.length === 0) throw new Error(`${path} has no house prices`);
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
	landAreaPath: string,
	housePricePath: string,
	imdPath: string,
	nimdmPath: string,
	wimdPath: string,
	simdPath: string,
): {
	catalog: DataCatalog;
	populationObservations: PopulationObservationArtifact;
	populationLocalAuthorityObservations: PopulationLocalAuthorityObservationArtifact;
	ghgEmissionsObservations: MeasureObservationArtifact;
	mobileCoverageObservations: MeasureObservationArtifact[];
	censusObservations: MeasureObservationArtifact[];
	populationDensityObservations: MeasureObservationArtifact;
	housePriceObservations: MeasureObservationArtifact;
	imdObservations: MeasureObservationArtifact[];
	nimdmObservations: MeasureObservationArtifact;
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

	/**
	 * Population density, the first measure derived from two others.
	 *
	 * Built here rather than at request time so the compatibility the roadmap
	 * gates this on is checked once, loudly, at build: the denominator's code
	 * set must match the population's exactly, and no area may have zero land.
	 * A mismatch throws rather than publishing a plausible-looking figure.
	 */
	const landArea = datasets.find((dataset) => dataset.id === "land-area");
	if (!landArea)
		throw new Error(`${manifestPath} has no land-area dataset`);
	const landAreaByCode = new Map(
		localAuthorityFieldPeriods(landAreaPath, "landSquareKm", 2024)[0]
			?.records.map((record) => [record.areaCode, record.value]) ?? [],
	);
	if (landAreaByCode.size === 0)
		throw new Error(`${landAreaPath} has no land area records`);
	const densityPeriods = localAuthorityPeriods.map((period) => ({
		period: period.period,
		records: period.records.map((record) => {
			const squareKm = landAreaByCode.get(record.areaCode);
			if (squareKm === undefined) {
				throw new Error(
					`${landAreaPath}: no land area for ${record.areaCode}, which the population partition publishes`,
				);
			}
			if (squareKm <= 0) {
				throw new Error(
					`${landAreaPath}: ${record.areaCode} has no land area, so its density is undefined`,
				);
			}
			return {
				areaCode: record.areaCode,
				value: record.value / squareKm,
				status: "derived" as const,
			};
		}),
	}));
	const unusedLandArea = [...landAreaByCode.keys()].filter(
		(code) =>
			!localAuthorityPeriods[0]?.records.some(
				(record) => record.areaCode === code,
			),
	);
	if (unusedLandArea.length > 0) {
		throw new Error(
			`${landAreaPath}: ${unusedLandArea.length} areas have a land area but no population, so the two partitions are not the same code set`,
		);
	}
	const densityContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "population-density",
		sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		periods: densityPeriods,
	});
	const densityMeasure: Measure = {
		id: "population-density",
		label: "Population density",
		valueKind: "ratio",
		unit: "people per square kilometre",
		aggregation: {
			kind: "intensive",
			operation: "weighted-mean",
			weight: {
				description:
					"The authority's land area in square kilometres, which is this measure's denominator.",
				datasetField: "landSquareKm",
			},
			available: false,
		},
		sources: [
			{
				datasetId: "population-uk",
				periods: densityPeriods.map((period) => period.period),
				sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
				coverage: {
					kind: "source-reported",
					countries: countriesFor(densityPeriods[0]?.records ?? []),
					recordCount: densityPeriods[0]?.records.length ?? 0,
					note: "Derived for every area and period the population partition publishes; the denominator covers exactly the same code set.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: false,
		},
		links: { data: "/v1/data/population-density" },
		derivedFrom: {
			datasetIds: ["population-uk", "land-area"],
			note: "Mid-year population divided by Standard Area Measurement land area. Both inputs must be attributed when this measure is used.",
		},
		notes: [
			"Derived: mid-year population divided by land area. It is not a source observation, and no publisher is responsible for the quotient.",
			"The denominator is the ONS Standard Area Measurement land area, which excludes inland water. The extent of the realm is larger and would give a lower figure; it is published in the land-area dataset but deliberately not used here.",
			"The population is published on the 2023 local-authority code vintage and the land area on the December 2024 vintage. The two code sets were verified identical when this was compiled, so no conversion was applied.",
			"Density is a ratio, so it does not add over areas. Combining authorities needs a land-area weighted mean, which is the same as recomputing it from the summed population and summed land area.",
		],
	};

	const housePrice = datasets.find((dataset) => dataset.id === "house-price");
	if (!housePrice)
		throw new Error(`${manifestPath} has no house-price dataset`);
	const housePriceByPeriod = housePricePeriods(housePricePath);
	const housePriceContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "house-price-median",
		sourceGeography: { type: "ward", boundaryYear: 2020 },
		periods: housePriceByPeriod,
	});
	const housePriceMeasure: Measure = {
		id: "house-price-median",
		label: "Median house price paid",
		valueKind: "currency",
		unit: "GBP",
		aggregation: {
			kind: "non-aggregatable",
			statistic: "median",
			note: "A median of ward medians is not the median of the underlying sales, and no weight recovers it. Combining areas needs the sales themselves, which this source does not publish.",
			available: false,
		},
		sources: [
			{
				datasetId: "house-price",
				periods: housePriceByPeriod.map((period) => period.period),
				sourceGeography: { type: "ward", boundaryYear: 2020 },
				coverage: {
					kind: "partial",
					countries: countriesFor(housePriceByPeriod.at(-1)?.records ?? []),
					recordCount: housePriceByPeriod.at(-1)?.records.length ?? 0,
					note: "Published for England and Wales only. A ward with too few sales in a period has no value for it, so the record count varies by period; the count here is the latest period's.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: false,
		},
		links: { data: "/v1/data/house-price-median" },
		notes: [
			"Each period is the year ending December of that year. The source is a quarterly rolling series whose last edition ends at March 2023; that partial year is not comparable and is not published here.",
			"Ward codes are those the publisher used, which are mostly December 2020 ward codes. Two Leeds wards carry later codes in the source itself, so the partition is not an exact code set for any one release.",
			"Medians of an even number of sales fall on a half penny in the workbook; values are rounded to the whole pound the publisher displays.",
		],
	};

	/**
	 * A nation's deprivation index, as its published rank and decile.
	 *
	 * Each index is a position within one nation, built to its own method,
	 * domains and date, so the four are separate measure families and none can
	 * be compared with another. A composite score is never published as a
	 * measure: the only published ways of combining one over areas use
	 * method-specific population weighting, and serving it bare invites
	 * averaging.
	 */
	const deprivationIndex = (index: {
		datasetId: "imd" | "wimd" | "simd";
		path: string;
		label: string;
		nation: "England" | "Wales" | "Scotland";
		otherNations: string;
		geography: SourceGeography["type"];
		areaNoun: string;
		rankField: string;
		decileField: string;
		rankNotes: string[];
		decileNotes: string[];
	}) => {
		const dataset = datasets.find(
			(candidate) => candidate.id === index.datasetId,
		);
		if (!dataset)
			throw new Error(`${manifestPath} has no ${index.datasetId} dataset`);
		if (
			dataset.summary.boundaryYears.length !== 1 ||
			dataset.summary.boundaryYears[0] !== 2011
		) {
			throw new Error(
				`${manifestPath}: ${index.datasetId} must declare boundary year 2011`,
			);
		}
		// The manifest's count is the compiled record count, checked below, so
		// the unit states exactly how many areas the ranks run across.
		const areaCount = dataset.summary.dataRecordCount;
		const areas = areaCount.toLocaleString("en-GB");
		const comparability = `A position within ${index.nation} alone. The ${index.otherNations} indices use different methods, domains and dates, so a rank or decile cannot be compared across nations.`;
		const metrics = [
			{
				id: `${index.datasetId}-rank`,
				label: `${index.label} rank`,
				field: index.rankField,
				unit: `rank of ${areas} ${index.areaNoun}, where 1 is the most deprived`,
				statistic: "rank" as const,
				note: "A rank records an order, not a distance: the gap between ranks 1 and 2 need not equal the gap between 100 and 101. Averaging ranks over areas produces a number with no meaning.",
				extra: index.rankNotes,
			},
			{
				id: `${index.datasetId}-decile`,
				label: `${index.label} decile`,
				field: index.decileField,
				unit: `decile, where 1 is the most deprived tenth of ${index.areaNoun}`,
				statistic: "decile" as const,
				note: `A decile is a band of ranks. Averaging deciles over areas produces a number with no meaning, and the share of a place's ${index.areaNoun} in each decile is the defensible summary instead.`,
				extra: index.decileNotes,
			},
		];
		return metrics.map((metric) => {
			const periods = localAuthorityFieldPeriods(
				index.path,
				metric.field,
				2011,
				index.geography,
			);
			const sourceGeography = {
				type: index.geography,
				boundaryYear: 2011,
			};
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId: metric.id,
				sourceGeography,
				periods,
			});
			const measure: Measure = {
				id: metric.id,
				label: metric.label,
				valueKind: "ordinal",
				unit: metric.unit,
				aggregation: {
					kind: "non-aggregatable",
					statistic: metric.statistic,
					note: metric.note,
					available: false,
				},
				sources: [
					{
						datasetId: index.datasetId,
						periods: periods.map((period) => period.period),
						sourceGeography,
						coverage: {
							kind: "partial",
							countries: countriesFor(periods[0]?.records ?? []),
							recordCount: periods[0]?.records.length ?? 0,
							note: `${index.nation} only. The other three nations publish their own indices, which are not comparable with this one.`,
						},
					},
				],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: false,
				},
				links: { data: `/v1/data/${metric.id}` },
				notes: [comparability, ...metric.extra],
			};
			if (periods[0]?.records.length !== areaCount) {
				throw new Error(
					`${index.path}: expected ${areaCount} ${index.areaNoun} from the manifest, found ${periods[0]?.records.length ?? 0}`,
				);
			}
			return {
				measure,
				artifact: {
					schemaVersion: 1 as const,
					contentHash: sha256(content),
					measureId: metric.id,
					sourceGeography,
					periods,
				},
			};
		});
	};

	const imdObservations = [
		...deprivationIndex({
			datasetId: "imd",
			path: imdPath,
			label: "Index of Multiple Deprivation",
			nation: "England",
			otherNations: "Welsh, Scottish and Northern Irish",
			geography: "lsoa",
			areaNoun: "LSOAs",
			rankField: "imdRank",
			decileField: "imdDecile",
			rankNotes: [
				"The published file itself contains 26 tied ranks; they are served as published rather than re-ranked.",
			],
			decileNotes: [
				"Deciles divide England's 32,844 LSOAs into ten near-equal groups by rank.",
			],
		}),
		...deprivationIndex({
			datasetId: "wimd",
			path: wimdPath,
			label: "Welsh Index of Multiple Deprivation",
			nation: "Wales",
			otherNations: "English, Scottish and Northern Irish",
			geography: "lsoa",
			areaNoun: "LSOAs",
			rankField: "wimdRank",
			decileField: "wimdDecile",
			rankNotes: [
				"Taken from the Welsh Government's published ranks. The separately published scores are rounded to one decimal place, so ranking them does not reproduce these ranks.",
			],
			decileNotes: [
				"Taken from the Welsh Government's published deciles.",
			],
		}),
		...deprivationIndex({
			datasetId: "simd",
			path: simdPath,
			label: "Scottish Index of Multiple Deprivation",
			nation: "Scotland",
			otherNations: "English, Welsh and Northern Irish",
			geography: "dataZone",
			areaNoun: "data zones",
			rankField: "simdRank",
			decileField: "simdDecile",
			rankNotes: [
				"SIMD 2020v2, taken from the Scottish Government's published data zone lookup, whose ranks agree with its separately published ranks workbook.",
			],
			decileNotes: [
				"Taken from the Scottish Government's published data zone lookup. Quintiles are also published there but are not offered as a measure.",
			],
		}),
	];
	const imdMeasures = imdObservations.map(({ measure }) => measure);

	/**
	 * The Northern Ireland Multiple Deprivation Measure 2017, as its published
	 * rank. NISRA publishes ranks for super output areas but not deciles; the
	 * deciles the website shows are its own division of the ranks, so they are
	 * not published here.
	 */
	const nimdm = datasets.find((dataset) => dataset.id === "nimdm");
	if (!nimdm) throw new Error(`${manifestPath} has no nimdm dataset`);
	const nimdmPeriods = localAuthorityFieldPeriods(
		nimdmPath,
		"nimdmRank",
		2011,
		"superOutputArea",
	);
	const nimdmContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "nimdm-rank",
		sourceGeography: { type: "superOutputArea", boundaryYear: 2011 },
		periods: nimdmPeriods,
	});
	const nimdmMeasure: Measure = {
		id: "nimdm-rank",
		label: "Northern Ireland Multiple Deprivation Measure rank",
		valueKind: "ordinal",
		unit: "rank of 890 super output areas, where 1 is the most deprived",
		aggregation: {
			kind: "non-aggregatable",
			statistic: "rank",
			note: "A rank records an order, not a distance. Averaging ranks over areas produces a number with no meaning.",
			available: false,
		},
		sources: [
			{
				datasetId: "nimdm",
				periods: nimdmPeriods.map((period) => period.period),
				sourceGeography: { type: "superOutputArea", boundaryYear: 2011 },
				coverage: {
					kind: "partial",
					countries: countriesFor(nimdmPeriods[0]?.records ?? []),
					recordCount: nimdmPeriods[0]?.records.length ?? 0,
					note: "Northern Ireland only. The other three nations publish their own indices, which are not comparable with this one.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: false,
		},
		links: { data: "/v1/data/nimdm-rank" },
		notes: [
			"A position within Northern Ireland alone. The English, Welsh and Scottish indices use different methods, domains and dates, so a rank cannot be compared across nations.",
			"The publisher labels these areas SOA2001. Super output areas were drawn for the 2001 census and reused unchanged for 2011, and every code matches the 2011 release.",
			"NISRA publishes ranks, not deciles, for super output areas, so no decile measure is offered.",
		],
	};

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
			densityMeasure,
			housePriceMeasure,
			...imdMeasures,
			nimdmMeasure,
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
				densityMeasure,
				housePriceMeasure,
				...imdMeasures,
				nimdmMeasure,
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
		imdObservations: imdObservations.map(({ artifact }) => artifact),
		nimdmObservations: {
			schemaVersion: 1,
			contentHash: sha256(nimdmContent),
			measureId: "nimdm-rank",
			sourceGeography: { type: "superOutputArea", boundaryYear: 2011 },
			periods: nimdmPeriods,
		},
		housePriceObservations: {
			schemaVersion: 1,
			contentHash: sha256(housePriceContent),
			measureId: "house-price-median",
			sourceGeography: { type: "ward", boundaryYear: 2020 },
			periods: housePriceByPeriod,
		},
		populationDensityObservations: {
			schemaVersion: 1,
			contentHash: sha256(densityContent),
			measureId: "population-density",
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			periods: densityPeriods,
		},
	};
};
