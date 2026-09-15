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
	type:
		| "ward"
		| "localAuthority"
		| "constituency"
		| "lsoa"
		| "dataZone"
		| "superOutputArea";
	boundaryYear: number;
};

export type MeasureSource = {
	datasetId: string;
	periods: string[];
	sourceGeography: SourceGeography;
	/**
	 * The observation artifact's filename stem, when one dataset contributes
	 * more than one source-geography partition to the same measure. Most
	 * measures retain the conventional measure-id filename.
	 */
	observationArtifact?: string;
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
			kind: "categorical";
			available: false;
			note: string;
	  }
	| {
			kind: "intensive";
			operation: "weighted-mean";
			/** The denominator a caller has to weight by, and where to find it. */
			weight: {
				description: string;
				datasetField: string;
				/** Published measure that supplies the weight when aggregation is available. */
				measureId?: string;
			};
			available: boolean;
	  }
	| {
			/**
			 * No operation recovers a combined value. A median of medians is not
			 * the median of the underlying sales, and no weight fixes that; the
			 * same is true of a rank or a decile. The statistic is named so a
			 * caller can see why rather than just that.
			 */
			kind: "non-aggregatable";
			statistic: "median" | "rank" | "decile" | "life-expectancy";
			note: string;
			available: false;
	  };

export type Measure = {
	id: string;
	label: string;
	valueKind:
		"count" | "quantity" | "ratio" | "currency" | "ordinal" | "categorical";
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
	/**
	 * Set when the publisher reports an interval around each value. Records then
	 * carry `confidenceInterval`; a value with no published interval has none,
	 * and no interval is ever computed here.
	 */
	uncertainty?: {
		kind: "confidence-interval";
		level: number;
		note: string;
	};
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
	/**
	 * The publisher's interval around this value, where one is published. The
	 * measure's `uncertainty` says what kind of interval it is.
	 */
	confidenceInterval?: { lower: number; upper: number };
};

/** A source-reported label, intentionally distinct from a numeric value. */
export type CategoricalObservation = {
	areaCode: string;
	category: string;
	status: "observed";
};

export type MeasureObservation = PopulationObservation | CategoricalObservation;

export const isNumericObservation = (
	record: MeasureObservation,
): record is PopulationObservation => "value" in record;

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
export type MeasureObservationArtifact<
	T extends MeasureObservation = PopulationObservation,
> = {
	schemaVersion: 1;
	contentHash: string;
	measureId: string;
	sourceGeography: SourceGeography;
	periods: Array<{ period: string; records: T[] }>;
};

export type AnyMeasureObservationArtifact =
	| MeasureObservationArtifact
	| MeasureObservationArtifact<CategoricalObservation>;

export type PopulationLocalAuthorityObservationArtifact = {
	schemaVersion: 1;
	contentHash: string;
	measureId: "population-estimate";
	sourceGeography: { type: "localAuthority"; boundaryYear: 2023 };
	periods: Array<{ period: string; records: PopulationObservation[] }>;
};

/**
 * The population artifacts that predate the per-period convention, which
 * carry their own shapes and file names.
 */
const LEGACY_POPULATION_DATASETS = new Set(["population", "population-uk"]);

export const isLegacyPopulationSource = (
	measureId: string,
	source: MeasureSource,
) =>
	measureId === "population-estimate" &&
	LEGACY_POPULATION_DATASETS.has(source.datasetId);

/**
 * The published file, without its extension, holding one measure source's
 * observations. A single-source measure keeps `{measure-id}-observations`; each
 * further source of a multi-source measure is named for its dataset.
 */
export const observationArtifactName = (
	measureId: string,
	source: MeasureSource,
) => {
	if (source.observationArtifact) return source.observationArtifact;
	if (measureId !== "population-estimate") return `${measureId}-observations`;
	if (source.datasetId === "population") return "population-observations";
	if (source.datasetId === "population-uk")
		return "population-local-authority-observations";
	return `${source.datasetId}-observations`;
};

/** The artifact holding a non-legacy measure source's observations. */
export const findMeasureObservations = (
	artifacts: AnyMeasureObservationArtifact[],
	measureId: string,
	source: MeasureSource,
) =>
	artifacts.find(
		(candidate) =>
			candidate.measureId === measureId &&
			candidate.sourceGeography.type === source.sourceGeography.type &&
			candidate.sourceGeography.boundaryYear ===
				source.sourceGeography.boundaryYear,
	);

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

const countriesFor = (records: Array<{ areaCode: string }>): Country[] =>
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

type ElectionMeasureField =
	| { kind: "field"; field: string }
	| { kind: "partyVotes"; party: string }
	| { kind: "partyVoteShare"; party: string; denominator: string };

const electionCodeKind = (code: string) =>
	/^[EW]05\d{6}$/.test(code)
		? "ward"
		: /^E58\d{6}$/.test(code)
			? "countyElectoralDivision"
			: /^(E14|W07|S14|N0[56])\d{6}$/.test(code)
				? "constituency"
				: undefined;

/**
 * Read one numeric series from a compiled election dataset. Election boundary
 * vintages legitimately change between polling years, so the caller later
 * splits these periods into source-geography partitions rather than claiming
 * one timeless constituency or ward geography.
 */
const electionFieldPeriods = (
	path: string,
	geography: "constituency" | "ward",
	field: ElectionMeasureField,
): Array<{
	period: string;
	boundaryYear: number;
	records: PopulationObservation[];
	unaddressableRecordCount: number;
	otherGeographyRecordCount: number;
}> => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PopulationFile;
	const periods = Object.entries(source)
		.map(([period, value]) => {
			if (!/^\d{4}$/.test(period))
				throw new Error(`${path}: invalid election period ${period}`);
			const entry = object(value, `${path}.${period}`);
			if (
				entry.year !== Number(period) ||
				entry.boundaryType !== geography ||
				typeof entry.boundaryYear !== "number"
			) {
				throw new Error(
					`${path}.${period}: expected ${geography} election data with a boundary year`,
				);
			}
			const data = object(entry.data, `${path}.${period}.data`);
			const unaddressableCodes = Object.keys(data).filter(
				(areaCode) => !electionCodeKind(areaCode) && areaCode !== "NA",
			);
			if (unaddressableCodes.length > 0) {
				throw new Error(
					`${path}.${period}: unsupported area code ${unaddressableCodes[0]}`,
				);
			}
			const otherGeographyRecordCount = Object.keys(data).filter(
				(areaCode) => {
					const kind = electionCodeKind(areaCode);
					return kind !== undefined && kind !== geography;
				},
			).length;
			return {
				period,
				boundaryYear: entry.boundaryYear,
				records: Object.entries(data)
					.map(
						([areaCode, record]):
							PopulationObservation | undefined => {
							if (electionCodeKind(areaCode) !== geography) {
								return undefined;
							}
							const row = object(
								record,
								`${path}.${period}.${areaCode}`,
							);
							const observed =
								field.kind === "field"
									? row[field.field]
									: field.kind === "partyVotes"
										? (object(
												row.partyVotes,
												`${path}.${period}.${areaCode}.partyVotes`,
											)[field.party] ?? 0)
										: (() => {
												const denominator = number(
													row[field.denominator],
													`${path}.${period}.${areaCode}.${field.denominator}`,
												);
												if (denominator <= 0) {
													throw new Error(
														`${path}.${period}.${areaCode}.${field.denominator} must be greater than zero for a party vote share`,
													);
												}
												const partyVotes =
													object(
														row.partyVotes,
														`${path}.${period}.${areaCode}.partyVotes`,
													)[field.party] ?? 0;
												return (
													(100 *
														number(
															partyVotes,
															`${path}.${period}.${areaCode}.partyVotes.${field.party}`,
														)) /
													denominator
												);
											})();
							return {
								areaCode,
								value: number(
									observed,
									`${path}.${period}.${areaCode}.${
										field.kind === "field"
											? field.field
											: field.kind === "partyVotes"
												? `partyVotes.${field.party}`
												: `partyVoteShare.${field.party}`
									}`,
								),
								status: "observed" as const,
							};
						},
					)
					.filter(
						(record): record is PopulationObservation =>
							record !== undefined,
					)
					.sort((left, right) =>
						left.areaCode.localeCompare(right.areaCode),
					),
				unaddressableRecordCount: Object.keys(data).filter(
					(areaCode) => areaCode === "NA",
				).length,
				otherGeographyRecordCount,
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	if (periods.length === 0)
		throw new Error(`${path} has no election periods`);
	return periods;
};

/** Read the publisher's winning-party label without coercing it to a number. */
const electionWinnerPeriods = (
	path: string,
	geography: "constituency" | "ward",
): Array<{
	period: string;
	boundaryYear: number;
	records: CategoricalObservation[];
}> => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PopulationFile;
	const periods = Object.entries(source)
		.map(([period, value]) => {
			const entry = object(value, `${path}.${period}`);
			if (
				!/^\d{4}$/.test(period) ||
				entry.year !== Number(period) ||
				entry.boundaryType !== geography ||
				typeof entry.boundaryYear !== "number"
			) {
				throw new Error(
					`${path}.${period}: expected ${geography} election results with a boundary year`,
				);
			}
			const results = object(entry.results, `${path}.${period}.results`);
			return {
				period,
				boundaryYear: entry.boundaryYear,
				records: Object.entries(results)
					.flatMap(([areaCode, category]) => {
						if (electionCodeKind(areaCode) !== geography) return [];
						return [
							{
								areaCode,
								category: string(
									category,
									`${path}.${period}.results.${areaCode}`,
								),
								status: "observed" as const,
							},
						];
					})
					.sort((left, right) =>
						left.areaCode.localeCompare(right.areaCode),
					),
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	if (periods.length === 0)
		throw new Error(`${path} has no election result periods`);
	return periods;
};

/**
 * The house price partition, restored to the codes its publisher used.
 *
 * The website moves Salford's twenty wards onto their 2021 codes so the map
 * joins, but those wards were redrawn in 2021: a price measured on the old ward
 * is not a price for the new one. The compiled record keeps the published code
 * as `sourceWardCode`, so every value is served under the code it was published
 * against, and the list of moved wards lives only in the website loader.
 */
/**
 * The last period published for a full calendar year. The workbook is a
 * quarterly rolling series, and each year's figure here is the year ending
 * December; the final edition stops at the year ending March 2023, which is
 * not comparable and so is not published as a period.
 */
/**
 * The four unitary authorities created in April 2023, with the districts each
 * replaced. A partition compiled onto current boundaries can hold both a
 * successor, summed from its predecessors, and the predecessors themselves;
 * summed over a country, those people would be counted twice.
 */
const APRIL_2023_LAD_MERGERS: Record<string, string[]> = {
	E06000063: ["E07000026", "E07000028", "E07000029"],
	E06000064: ["E07000027", "E07000030", "E07000031"],
	E06000065: [
		"E07000163",
		"E07000164",
		"E07000165",
		"E07000166",
		"E07000167",
		"E07000168",
		"E07000169",
	],
	E06000066: ["E07000187", "E07000188", "E07000189", "E07000246"],
};

const LAST_DECEMBER_PERIOD = 2022;

/**
 * The two English authorities whose codes changed in 2025, from their April
 * 2023 code to the one a 2025 partition carries.
 */
const RECODED_2025: Record<string, string> = {
	E08000016: "E08000038",
	E08000019: "E08000039",
};

/**
 * One field of a single-period local-authority dataset, keeping the gaps.
 *
 * Unlike `localAuthorityFieldPeriods`, a missing or null value is not an error
 * but an absence the publisher chose, such as a survey estimate suppressed as
 * unreliable; it is returned in `absent` so the caller can name it. Rows whose
 * code is not an authority, such as a county or region total published in the
 * same table, are left out when `isAuthority` says so.
 */
const localAuthorityFieldWithGaps = (
	path: string,
	field: string,
	boundaryYear: number,
	isAuthority: (code: string) => boolean = () => true,
) => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PopulationFile;
	const entries = Object.entries(source);
	if (entries.length !== 1)
		throw new Error(`${path}: expected a single period`);
	const [[period, value]] = entries as [[string, unknown]];
	const entry = object(value, `${path}.${period}`);
	if (
		entry.boundaryYear !== boundaryYear ||
		entry.boundaryType !== "localAuthority"
	)
		throw new Error(
			`${path}.${period}: expected localAuthority data on the ${boundaryYear} code vintage`,
		);
	const records: PopulationObservation[] = [];
	const absent: string[] = [];
	for (const [areaCode, record] of Object.entries(
		object(entry.data, `${path}.${period}.data`),
	)) {
		if (!isPublishedAreaCode(areaCode))
			throw new Error(`${path}: unsupported area code ${areaCode}`);
		if (!isAuthority(areaCode)) continue;
		let observed: unknown = record;
		for (const segment of field.split("."))
			observed =
				observed && typeof observed === "object"
					? (observed as Record<string, unknown>)[segment]
					: undefined;
		if (observed === null || observed === undefined) {
			absent.push(areaCode);
			continue;
		}
		if (typeof observed !== "number" || !Number.isFinite(observed))
			throw new Error(
				`${path}.${period}.${areaCode}.${field} must be a finite number or absent`,
			);
		records.push({ areaCode, value: observed, status: "observed" });
	}
	records.sort((left, right) => left.areaCode.localeCompare(right.areaCode));
	return { period, records, absent: absent.sort() };
};

/**
 * A period of a partition compiled onto April 2023 authorities, with the
 * districts they replaced removed.
 *
 * The census reports on 2021 districts, and the compiled datasets add each
 * April 2023 authority summed from them while keeping the districts too.
 * Serving both counts those residents twice in any sum. So a successor that
 * is present must be exactly the sum of its predecessors, which are then
 * dropped, and what remains must be exactly the expected 2023 code set; any
 * other shape is refused rather than published.
 */
export const onApril2023Authorities = (
	period: MeasureObservationArtifact["periods"][number],
	expectedCodes: Iterable<string>,
): MeasureObservationArtifact["periods"][number] => {
	const byCode = new Map(
		period.records.map((record) => [record.areaCode, record]),
	);
	const replaced = new Set<string>();
	for (const [successor, predecessors] of Object.entries(
		APRIL_2023_LAD_MERGERS,
	)) {
		const record = byCode.get(successor);
		if (!record) continue;
		const summed = predecessors.reduce((total, code) => {
			const predecessor = byCode.get(code);
			if (!predecessor || !isNumericObservation(predecessor))
				throw new Error(`${successor} has no predecessor ${code}`);
			replaced.add(code);
			return total + predecessor.value;
		}, 0);
		if (!isNumericObservation(record) || record.value !== summed)
			throw new Error(
				`${successor} is not the sum of its predecessors ${predecessors.join(", ")}`,
			);
	}
	const records = period.records.filter(
		(record) => !replaced.has(record.areaCode),
	);
	const expected = [...expectedCodes].sort().join(",");
	const published = records
		.map((record) => record.areaCode)
		.sort()
		.join(",");
	if (published !== expected)
		throw new Error("does not hold exactly the April 2023 authorities");
	return { ...period, records };
};

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
		const sourceWardCode = object(
			record,
			`${path}.${compiledCode}`,
		).sourceWardCode;
		const areaCode =
			typeof sourceWardCode === "string" ? sourceWardCode : compiledCode;
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

	/**
	 * Single-period local-authority indicators, each checked against the code
	 * set it claims before it is published.
	 *
	 * Every value must name an authority of the expected set, and any authority
	 * of that set without a value is listed in the coverage note by code rather
	 * than left for a caller to discover as a short total. A dataset compiled
	 * with the April 2023 authorities beside the districts they replaced is
	 * reduced to the authorities first, as the census partitions are.
	 */
	const england2023 = [...populationCodes].filter((code) =>
		code.startsWith("E"),
	);
	const england2025 = england2023.map((code) => RECODED_2025[code] ?? code);
	type Indicator = {
		id: string;
		label: string;
		field: string;
		valueKind: Measure["valueKind"];
		unit: string;
		aggregation: MeasureAggregation;
		notes: string[];
	};
	const indicatorObservations: Array<{
		measure: Measure;
		artifact: MeasureObservationArtifact;
	}> = [];
	const publishIndicators = (spec: {
		datasetId: string;
		path: string;
		boundaryYear: number;
		period: string;
		expectedCodes: string[];
		isAuthority?: (code: string) => boolean;
		mergeApril2023?: boolean;
		coverageNote: string;
		notes: string[];
		indicators: Indicator[];
	}) => {
		const dataset = datasets.find(
			(candidate) => candidate.id === spec.datasetId,
		);
		if (!dataset)
			throw new Error(`${manifestPath} has no ${spec.datasetId} dataset`);
		if (
			dataset.summary.boundaryYears.length !== 1 ||
			dataset.summary.boundaryYears[0] !== spec.boundaryYear
		)
			throw new Error(
				`${manifestPath}: ${spec.datasetId} must declare boundary year ${spec.boundaryYear}`,
			);
		const expected = new Set(spec.expectedCodes);
		for (const indicator of spec.indicators) {
			const read = localAuthorityFieldWithGaps(
				spec.path,
				indicator.field,
				spec.boundaryYear,
				spec.isAuthority,
			);
			let records = read.records;
			if (spec.mergeApril2023) {
				const present = new Set(
					records.map((record) => record.areaCode),
				);
				records = onApril2023Authorities(
					{ period: spec.period, records },
					[...expected].filter((code) => present.has(code)),
				).records;
			}
			const unexpected = records.filter(
				(record) => !expected.has(record.areaCode),
			);
			if (unexpected.length > 0)
				throw new Error(
					`${spec.path}: ${indicator.id} has codes outside its ${spec.boundaryYear} authority set, starting with ${unexpected[0]!.areaCode}`,
				);
			const published = new Set(records.map((record) => record.areaCode));
			const missing = spec.expectedCodes
				.filter((code) => !published.has(code))
				.sort();
			const periods = [{ period: spec.period, records }];
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId: indicator.id,
				sourceGeography: {
					type: "localAuthority",
					boundaryYear: spec.boundaryYear,
				},
				periods,
			});
			indicatorObservations.push({
				measure: {
					id: indicator.id,
					label: indicator.label,
					valueKind: indicator.valueKind,
					unit: indicator.unit,
					aggregation: indicator.aggregation,
					sources: [
						{
							datasetId: spec.datasetId,
							periods: [spec.period],
							sourceGeography: {
								type: "localAuthority",
								boundaryYear: spec.boundaryYear,
							},
							coverage: {
								kind:
									missing.length === 0
										? "source-reported"
										: "partial",
								countries: countriesFor(records),
								recordCount: records.length,
								note:
									missing.length === 0
										? spec.coverageNote
										: `${spec.coverageNote} No value is published for ${missing.length} of the ${expected.size} authorities: ${missing.join(", ")}.`,
							},
						},
					],
					availability: {
						sourceExact: true,
						conversion: false,
						aggregation: indicator.aggregation.available,
					},
					links: { data: `/v1/data/${indicator.id}` },
					notes: [...indicator.notes, ...spec.notes],
				},
				artifact: {
					schemaVersion: 1,
					contentHash: sha256(content),
					measureId: indicator.id,
					sourceGeography: {
						type: "localAuthority",
						boundaryYear: spec.boundaryYear,
					},
					periods,
				},
			});
		}
	};

	const premisesShare = (
		id: string,
		label: string,
		field: string,
		note: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "ratio",
		unit: "% of premises",
		aggregation: {
			kind: "intensive",
			operation: "weighted-mean",
			weight: {
				description:
					"The authority's count of all premises, which the published availability percentages are computed against.",
				datasetField: "All Premises",
			},
			available: false,
		},
		notes: [note],
	});
	publishIndicators({
		datasetId: "broadband",
		path: broadbandPath,
		boundaryYear: 2024,
		period: "2025-07",
		expectedCodes: [...populationCodes],
		coverageNote:
			"Published source records cover every authority in all four UK nations.",
		notes: [
			"Availability, not take-up: a premises counts where the service can be ordered, whether or not anyone there has it.",
			"This is a share of premises, so it does not add over areas. Combining authorities needs a mean weighted by premises, which the source publishes but this measure does not serve; averaging the percentages flat would weigh a small authority as heavily as a city.",
			"Ofcom's July 2025 Connected Nations snapshot, on local authority codes shared by every release from May 2023 to December 2024.",
		],
		indicators: [
			premisesShare(
				"broadband-superfast-availability",
				"Superfast broadband availability",
				"pctSuperfast",
				"Premises able to receive download speeds of at least 30 Mbit/s.",
			),
			premisesShare(
				"broadband-ultrafast-availability",
				"Ultrafast broadband availability",
				"pctUltrafast",
				"Premises able to receive download speeds of at least 100 Mbit/s.",
			),
			premisesShare(
				"broadband-full-fibre-availability",
				"Full fibre availability",
				"pctFullFibre",
				"Premises where a full fibre connection, fibre all the way to the premises, is available.",
			),
			premisesShare(
				"broadband-gigabit-availability",
				"Gigabit broadband availability",
				"pctGigabit",
				"Premises able to receive download speeds of at least 1 Gbit/s, by any technology.",
			),
		],
	});
	const claimants = (
		id: string,
		label: string,
		field: string,
		unit: string,
		note: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "count",
		unit,
		aggregation: { kind: "extensive", operation: "sum", available: true },
		notes: [note],
	});
	publishIndicators({
		datasetId: "claimant-count",
		path: claimantCountPath,
		boundaryYear: 2024,
		period: "2026-04",
		expectedCodes: [...populationCodes],
		mergeApril2023: true,
		coverageNote:
			"Published source records cover every authority in all four UK nations.",
		notes: [
			"People claiming Universal Credit or Jobseeker's Allowance principally for the reason of being unemployed, in April 2026. It counts claimants, not unemployment: the survey measure of unemployment includes people who claim nothing and excludes some who do.",
			"Counts are rounded by the publisher to the nearest five, so a sum over areas carries that rounding from every member.",
			"The published rates, claimants as a share of residents aged 16 to 64, are not served: a rate does not add over areas and would need the working-age population as a weight.",
			"The compiled dataset holds the four authorities created in April 2023 beside the districts they replaced; the districts are dropped after checking each authority is their exact sum, so no claimant is counted twice.",
		],
		indicators: [
			claimants(
				"claimant-count",
				"Claimant count",
				"totalCount",
				"claimants aged 16 and over",
				"Every claimant aged 16 and over.",
			),
			claimants(
				"claimant-count-16-to-24",
				"Claimant count aged 16 to 24",
				"youthCount",
				"claimants aged 16 to 24",
				"Claimants aged 16 to 24, a subset of the claimant count.",
			),
		],
	});
	const indicatorMeasures = indicatorObservations.map(
		({ measure }) => measure,
	);

	/**
	 * Population density, the first measure derived from two others.
	 *
	 * Built here rather than at request time so the compatibility the roadmap
	 * gates this on is checked once, loudly, at build: the denominator's code
	 * set must match the population's exactly, and no area may have zero land.
	 * A mismatch throws rather than publishing a plausible-looking figure.
	 */
	const landArea = datasets.find((dataset) => dataset.id === "land-area");
	if (!landArea) throw new Error(`${manifestPath} has no land-area dataset`);
	const landAreaByCode = new Map(
		localAuthorityFieldPeriods(
			landAreaPath,
			"landSquareKm",
			2024,
		)[0]?.records.map((record) => [record.areaCode, record.value]) ?? [],
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
					countries: countriesFor(
						housePriceByPeriod.at(-1)?.records ?? [],
					),
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
			throw new Error(
				`${manifestPath} has no ${index.datasetId} dataset`,
			);
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
				sourceGeography: {
					type: "superOutputArea",
					boundaryYear: 2011,
				},
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

	/**
	 * Life expectancy at birth, as ONS publishes it for local areas: every
	 * three-year period from 2001 to 2003, each with its 95% confidence interval.
	 *
	 * ONS publishes male and female series but no persons total, so there is no
	 * total measure. The series is read from its own compiled dataset rather than
	 * the website's, which holds only the latest period and adds averaged values
	 * for the four authorities created in April 2023.
	 */
	const lifeExpectancySource = JSON.parse(
		readFileSync(lifeExpectancySeriesPath, "utf8"),
	) as PopulationFile;
	const lifeExpectancyPeriods = Object.entries(lifeExpectancySource)
		.map(([key, value]) => {
			const entry = object(value, `${lifeExpectancySeriesPath}.${key}`);
			if (
				entry.boundaryType !== "localAuthority" ||
				entry.boundaryYear !== 2021 ||
				typeof entry.period !== "string" ||
				!/^\d{4}-\d{4}$/.test(entry.period)
			) {
				throw new Error(
					`${lifeExpectancySeriesPath}.${key}: expected a local-authority period on the 2021 code vintage`,
				);
			}
			return {
				period: entry.period,
				data: object(
					entry.data,
					`${lifeExpectancySeriesPath}.${key}.data`,
				),
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	const lifeExpectancyMeasures = (["male", "female"] as const).map((sex) => {
		const measureId = `life-expectancy-${sex}`;
		const periods = lifeExpectancyPeriods.map(({ period, data }) => ({
			period,
			records: Object.entries(data)
				.map(([areaCode, record]) => {
					const context = `${lifeExpectancySeriesPath}.${period}.${areaCode}.${sex}`;
					if (!isPublishedAreaCode(areaCode))
						throw new Error(`${context}: unsupported area code`);
					const estimate = object(
						object(record, context)[sex],
						context,
					);
					const value = number(estimate.value, `${context}.value`);
					const lower = number(estimate.lower, `${context}.lower`);
					const upper = number(estimate.upper, `${context}.upper`);
					if (!(lower <= value && value <= upper))
						throw new Error(
							`${context}: the interval ${lower} to ${upper} does not contain ${value}`,
						);
					return {
						areaCode,
						value,
						status: "observed" as const,
						confidenceInterval: { lower, upper },
					};
				})
				.sort((left, right) =>
					left.areaCode.localeCompare(right.areaCode),
				),
		}));
		const sourceGeography = {
			type: "localAuthority" as const,
			boundaryYear: 2021,
		};
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId,
			sourceGeography,
			periods,
		});
		const latestRecords = periods.at(-1)?.records ?? [];
		const measure: Measure = {
			id: measureId,
			label: `${sex === "male" ? "Male" : "Female"} life expectancy at birth`,
			valueKind: "quantity",
			unit: "years",
			aggregation: {
				kind: "non-aggregatable",
				statistic: "life-expectancy",
				note: "The life expectancy of a combined population is not an average of its areas' life expectancies, weighted or not. It has to be recalculated from deaths and population by age, which this source does not publish.",
				available: false,
			},
			sources: [
				{
					datasetId: "life-expectancy-series",
					periods: periods.map((period) => period.period),
					sourceGeography,
					coverage: {
						kind: "partial",
						countries: countriesFor(latestRecords),
						recordCount: latestRecords.length,
						note: "England, Wales and Northern Ireland. Scotland's local life expectancy is published separately by National Records of Scotland.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: false,
			},
			links: { data: `/v1/data/${measureId}` },
			uncertainty: {
				kind: "confidence-interval",
				level: 0.95,
				note: "The publisher's 95% confidence interval, reflecting the random variation in deaths behind each estimate. Overlapping intervals mean two areas cannot be told apart with confidence, even when their central values differ.",
			},
			notes: [
				"Each period is a three-year period life expectancy, not a forecast for anyone born in it.",
				"On the publisher's December 2021 local-authority codes, to which ONS restates the whole series. The four authorities created in April 2023 are not published and are not served; their predecessor districts are.",
			],
		};
		return {
			measure,
			artifact: {
				schemaVersion: 1 as const,
				contentHash: sha256(content),
				measureId,
				sourceGeography,
				periods,
			},
		};
	});

	/**
	 * Elections are source-exact, polling-year measures. A constituency or ward
	 * code can be reused in a later boundary release, but that does not move an
	 * election result onto the later map; every distinct source boundary year is
	 * therefore its own partition. Vote counts add within one election. Turnout
	 * is a ratio; party shares are published only when a source provides a valid
	 * ballot denominator, and carry that denominator for weighted aggregation.
	 */
	const partyNames: Record<string, string> = {
		APNI: "Alliance Party",
		BRX: "Brexit Party",
		CON: "Conservative",
		DUP: "Democratic Unionist Party",
		GREEN: "Green",
		IND: "Independent",
		LAB: "Labour",
		LD: "Liberal Democrat",
		OTHER: "Other candidates",
		PC: "Plaid Cymru",
		REF: "Reform",
		RUK: "Reform UK",
		SDLP: "Social Democratic and Labour Party",
		SF: "Sinn Féin",
		SNP: "Scottish National Party",
		UKIP: "UKIP",
		UUP: "Ulster Unionist Party",
	};
	const electionMeasures = (election: {
		datasetId: "general-election" | "local-election";
		path: string;
		geography: "constituency" | "ward";
		label: string;
		countField: string;
		countId: string;
		countLabel: string;
		countNote: string;
		turnoutPeriods: "all" | "reported";
		partyShareDenominator?: {
			field: string;
			measureId: string;
			label: string;
		};
	}) => {
		const dataset = datasets.find(
			(candidate) => candidate.id === election.datasetId,
		);
		if (!dataset)
			throw new Error(
				`${manifestPath} has no ${election.datasetId} dataset`,
			);
		const countPeriods = electionFieldPeriods(
			election.path,
			election.geography,
			{
				kind: "field",
				field: election.countField,
			},
		);
		const recordCount = countPeriods.reduce(
			(total, period) => total + period.records.length,
			0,
		);
		const unaddressableRecordCount = countPeriods.reduce(
			(total, period) => total + period.unaddressableRecordCount,
			0,
		);
		const otherGeographyRecordCount = countPeriods.reduce(
			(total, period) => total + period.otherGeographyRecordCount,
			0,
		);
		if (
			recordCount +
				unaddressableRecordCount +
				otherGeographyRecordCount !==
			dataset.summary.dataRecordCount
		) {
			throw new Error(
				`${election.path}: expected ${dataset.summary.dataRecordCount} records from the manifest, found ${recordCount} ${election.geography} records, ${otherGeographyRecordCount} records in another geography and ${unaddressableRecordCount} unaddressable`,
			);
		}
		if (countPeriods.length !== dataset.summary.datasetCount) {
			throw new Error(
				`${election.path}: expected ${dataset.summary.datasetCount} election periods from the manifest, found ${countPeriods.length}`,
			);
		}

		const parties = [
			...new Set(
				Object.values(
					JSON.parse(
						readFileSync(election.path, "utf8"),
					) as PopulationFile,
				).flatMap((value) =>
					Object.values(
						object(value, election.path).data as Record<
							string,
							unknown
						>,
					).flatMap((record) =>
						Object.keys(
							object(record, election.path).partyVotes as Record<
								string,
								unknown
							>,
						),
					),
				),
			),
		].sort();
		const partyShareDenominator = election.partyShareDenominator;
		const metrics: Array<{
			id: string;
			label: string;
			field: ElectionMeasureField;
			aggregation: MeasureAggregation;
			notes: string[];
			filter?: (period: (typeof countPeriods)[number]) => boolean;
		}> = [
			{
				id: election.countId,
				label: election.countLabel,
				field: { kind: "field", field: election.countField },
				aggregation: {
					kind: "extensive",
					operation: "sum",
					available: true,
				},
				notes: [
					election.countNote,
					...(unaddressableRecordCount > 0
						? [
								`${unaddressableRecordCount} source row${unaddressableRecordCount === 1 ? "" : "s"} with the literal ward code NA is excluded: it has no official area identity to which the API can attach a value.`,
							]
						: []),
					...(otherGeographyRecordCount > 0
						? [
								`${otherGeographyRecordCount} source row${otherGeographyRecordCount === 1 ? "" : "s"} with county-electoral-division codes is excluded from this ${election.geography} measure. Historical county-electoral-division boundary vintages are not yet published by the API.`,
							]
						: []),
				],
			},
			{
				id: `${election.datasetId}-turnout`,
				label: `${election.label} turnout`,
				field: { kind: "field", field: "turnoutPercent" },
				aggregation: {
					kind: "intensive",
					operation: "weighted-mean",
					weight: {
						description:
							"The electorate for the same election and area.",
						datasetField: "electorate",
					},
					available: false,
				},
				notes: [
					"Turnout is a percentage of the electorate, so it does not add across areas. A combined turnout needs the summed electorate as its denominator.",
					...(election.turnoutPeriods === "reported"
						? [
								"The Local Elections Archive Project files for 2016–2019 do not publish electorate or turnout, so those polling years are deliberately absent rather than represented as zero turnout.",
							]
						: []),
				],
				...(election.turnoutPeriods === "reported"
					? {
							filter: (period) =>
								period.records.some(
									(record) => record.value > 0,
								),
						}
					: {}),
			},
			...parties.map((party) => ({
				id: `${election.datasetId}-${party.toLowerCase()}-votes`,
				label: `${election.label} votes for ${partyNames[party] ?? party}`,
				field: { kind: "partyVotes" as const, party },
				aggregation: {
					kind: "extensive" as const,
					operation: "sum" as const,
					available: true,
				},
				notes: [
					`Votes for ${partyNames[party] ?? party}. An area where the party did not stand is recorded as zero votes; this is a count, not a vote share.`,
				],
			})),
			...(partyShareDenominator
				? parties.map((party) => ({
						id: `${election.datasetId}-${party.toLowerCase()}-vote-share`,
						label: `${election.label} vote share for ${partyNames[party] ?? party}`,
						field: {
							kind: "partyVoteShare" as const,
							party,
							denominator: partyShareDenominator.field,
						},
						aggregation: {
							kind: "intensive" as const,
							operation: "weighted-mean" as const,
							weight: {
								description: `The area's ${partyShareDenominator.label.toLowerCase()} for the same election.`,
								datasetField: partyShareDenominator.field,
								measureId: partyShareDenominator.measureId,
							},
							available: true,
						},
						notes: [
							`${partyNames[party] ?? party} votes divided by the source-published ${partyShareDenominator.label.toLowerCase()}. The percentage does not add across areas; the API combines it by summing party votes and valid ballots through this weight.`,
						],
					}))
				: []),
		];

		return metrics.flatMap((metric) => {
			const periods = electionFieldPeriods(
				election.path,
				election.geography,
				metric.field,
			).filter(metric.filter ?? (() => true));
			const byBoundaryYear = new Map<number, typeof periods>();
			for (const period of periods) {
				const partition = byBoundaryYear.get(period.boundaryYear) ?? [];
				partition.push(period);
				byBoundaryYear.set(period.boundaryYear, partition);
			}
			const sources = [...byBoundaryYear.entries()]
				.sort(([left], [right]) => left - right)
				.map(([boundaryYear, sourcePeriods]) => {
					const sourceUnaddressableRecordCount = sourcePeriods.reduce(
						(total, period) =>
							total + period.unaddressableRecordCount,
						0,
					);
					const sourceOtherGeographyRecordCount =
						sourcePeriods.reduce(
							(total, period) =>
								total + period.otherGeographyRecordCount,
							0,
						);
					const sourceGeography = {
						type: election.geography,
						boundaryYear,
					} as SourceGeography;
					const observationArtifact = `${metric.id}-${election.geography}-${boundaryYear}-observations`;
					return {
						datasetId: election.datasetId,
						periods: sourcePeriods.map((period) => period.period),
						sourceGeography,
						observationArtifact,
						coverage: {
							kind: "partial" as const,
							countries: countriesFor(
								sourcePeriods[0]?.records ?? [],
							),
							recordCount: sourcePeriods[0]?.records.length ?? 0,
							note: `Source-exact ${election.label.toLowerCase()} records for the listed polling years. Record coverage varies with the areas that held an election.${sourceUnaddressableRecordCount > 0 ? " Rows with the literal, unaddressable code NA are excluded." : ""}${sourceOtherGeographyRecordCount > 0 ? " County-electoral-division rows are excluded from this ward measure pending historical boundary releases." : ""}`,
						},
					};
				});
			const measure: Measure = {
				id: metric.id,
				label: metric.label,
				valueKind:
					metric.id.endsWith("turnout") ||
					metric.id.endsWith("vote-share")
						? "ratio"
						: "count",
				unit:
					metric.id.endsWith("turnout") ||
					metric.id.endsWith("vote-share")
						? "percent"
						: "votes",
				aggregation: metric.aggregation,
				sources,
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: metric.aggregation.available,
				},
				links: { data: `/v1/data/${metric.id}` },
				notes: metric.notes,
			};
			return sources.map((source) => {
				const sourcePeriods =
					byBoundaryYear.get(source.sourceGeography.boundaryYear) ??
					[];
				const artifactPeriods = sourcePeriods.map(
					({ period, records }) => ({
						period,
						records,
					}),
				);
				const content = JSON.stringify({
					schemaVersion: 1,
					measureId: metric.id,
					sourceGeography: source.sourceGeography,
					periods: artifactPeriods,
				});
				return {
					measure,
					artifact: {
						schemaVersion: 1 as const,
						contentHash: sha256(content),
						measureId: metric.id,
						sourceGeography: source.sourceGeography,
						periods: artifactPeriods,
					},
				};
			});
		});
	};
	const electionWinnerMeasures = (election: {
		datasetId: "general-election" | "local-election";
		path: string;
		geography: "constituency" | "ward";
		label: string;
	}) => {
		const periods = electionWinnerPeriods(
			election.path,
			election.geography,
		);
		const byBoundaryYear = new Map<number, typeof periods>();
		for (const period of periods) {
			const partition = byBoundaryYear.get(period.boundaryYear) ?? [];
			partition.push(period);
			byBoundaryYear.set(period.boundaryYear, partition);
		}
		const measureId = `${election.datasetId}-winning-party`;
		const sources = [...byBoundaryYear.entries()]
			.sort(([left], [right]) => left - right)
			.map(([boundaryYear, sourcePeriods]) => ({
				datasetId: election.datasetId,
				periods: sourcePeriods.map((period) => period.period),
				sourceGeography: {
					type: election.geography,
					boundaryYear,
				} as SourceGeography,
				observationArtifact: `${measureId}-${election.geography}-${boundaryYear}-observations`,
				coverage: {
					kind: "partial" as const,
					countries: countriesFor(sourcePeriods[0]?.records ?? []),
					recordCount: sourcePeriods[0]?.records.length ?? 0,
					note: `Source-reported ${election.label.toLowerCase()} winning-party labels for the listed polling years. This is categorical data, not a vote count or party ranking.`,
				},
			}));
		const measure: Measure = {
			id: measureId,
			label: `${election.label} winning party`,
			valueKind: "categorical",
			unit: "party",
			aggregation: {
				kind: "categorical",
				available: false,
				note: "A winning-party label has no numeric order and cannot be summed, averaged, ranked or converted across areas.",
			},
			sources,
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: false,
			},
			links: { data: `/v1/data/${measureId}` },
			notes: [
				"The label records the party that won the source area. It is not a numeric score, and a group of areas can have a distribution of winners rather than one additive outcome.",
			],
		};
		return sources.map((source) => {
			const sourcePeriods =
				byBoundaryYear.get(source.sourceGeography.boundaryYear) ?? [];
			const artifactPeriods = sourcePeriods.map(
				({ period, records }) => ({
					period,
					records,
				}),
			);
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId,
				sourceGeography: source.sourceGeography,
				periods: artifactPeriods,
			});
			return {
				measure,
				artifact: {
					schemaVersion: 1 as const,
					contentHash: sha256(content),
					measureId,
					sourceGeography: source.sourceGeography,
					periods: artifactPeriods,
				},
			};
		});
	};
	const electionObservations = [
		...electionMeasures({
			datasetId: "general-election",
			path: generalElectionPath,
			geography: "constituency",
			label: "General election",
			countField: "validVotes",
			countId: "general-election-valid-votes",
			countLabel: "General election valid votes",
			countNote:
				"Valid ballot papers counted in each constituency. Invalid ballot papers are excluded, as in the source field.",
			turnoutPeriods: "all",
			partyShareDenominator: {
				field: "validVotes",
				measureId: "general-election-valid-votes",
				label: "valid ballot papers",
			},
		}),
		...electionWinnerMeasures({
			datasetId: "general-election",
			path: generalElectionPath,
			geography: "constituency",
			label: "General election",
		}),
		...electionMeasures({
			datasetId: "local-election",
			path: localElectionPath,
			geography: "ward",
			label: "Local election",
			countField: "totalVotes",
			countId: "local-election-candidate-votes",
			countLabel: "Local election candidate votes",
			countNote:
				"Candidate votes counted in each ward. Multi-member wards can allow each voter more than one vote, so this is not necessarily a count of ballot papers.",
			turnoutPeriods: "reported",
		}),
		...electionWinnerMeasures({
			datasetId: "local-election",
			path: localElectionPath,
			geography: "ward",
			label: "Local election",
		}),
	];
	const electionMeasureDefinitions = [
		...new Map(
			electionObservations.map(({ measure }) => [measure.id, measure]),
		).values(),
	];

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
			...electionMeasureDefinitions,
			densityMeasure,
			housePriceMeasure,
			...imdMeasures,
			nimdmMeasure,
			...lifeExpectancyMeasures.map(({ measure }) => measure),
			emissionsMeasure,
			jobsMeasure,
			...mobileMeasures,
			...indicatorMeasures,
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
				...electionMeasureDefinitions,
				densityMeasure,
				housePriceMeasure,
				...imdMeasures,
				nimdmMeasure,
				...lifeExpectancyMeasures.map(({ measure }) => measure),
				emissionsMeasure,
				jobsMeasure,
				...mobileMeasures,
				...indicatorMeasures,
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
		indicatorObservations: indicatorObservations.map(
			({ artifact }) => artifact,
		),
		imdObservations: imdObservations.map(({ artifact }) => artifact),
		lifeExpectancyObservations: lifeExpectancyMeasures.map(
			({ artifact }) => artifact,
		),
		electionObservations: electionObservations.map(
			({ artifact }) => artifact,
		),
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
