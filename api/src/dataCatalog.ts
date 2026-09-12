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

export type PopulationSource = {
	datasetId: "population" | "population-uk";
	periods: string[];
	sourceGeography: { type: "ward" | "localAuthority"; boundaryYear: 2023 };
	coverage: {
		kind: "partial" | "source-reported";
		countries: Country[];
		recordCount: number;
		note: string;
	};
};

export type PopulationMeasure = {
	id: "population-estimate";
	label: "Population estimate";
	valueKind: "count";
	unit: "people";
	aggregation: { kind: "extensive"; operation: "sum"; available: false };
	sources: PopulationSource[];
	availability: {
		sourceExact: true;
		conversion: false;
		aggregation: false;
	};
	links: { data: "/v1/data/population-estimate" };
};

export type DataCatalog = {
	schemaVersion: 1;
	contentHash: string;
	source: {
		artifact: "data/precompiled/dataset-manifest.json";
		manifestVersion: number;
	};
	datasets: DatasetCatalogueEntry[];
	measures: PopulationMeasure[];
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
 * Compile source-lineage metadata and one intentionally narrow, source-exact
 * population measure. It does not select a geometry release: the published
 * input records only declare the Ward 2023 code vintage, not a boundary month.
 */
export const compileDataCatalog = (
	manifestPath: string,
	populationPath: string,
	populationUkPath: string,
): {
	catalog: DataCatalog;
	populationObservations: PopulationObservationArtifact;
	populationLocalAuthorityObservations: PopulationLocalAuthorityObservationArtifact;
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
	const measure: PopulationMeasure = {
		id: "population-estimate",
		label: "Population estimate",
		valueKind: "count",
		unit: "people",
		aggregation: { kind: "extensive", operation: "sum", available: false },
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
			aggregation: false,
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
		measures: [measure],
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
			measures: [measure],
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
	};
};
