import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	ObservationCache,
	lazySourceObservations,
	observationArtifactName,
	type DataCatalog,
	type Measure,
	type MeasureDimensions,
	type MeasureValuesContext,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import type { StatisticsReadPath } from "@uk-data-atlas/atlas-runtime/storage";

/**
 * A small statistics database, catalogue and reviewed dimension mapping for
 * the shared measure query: population (a sum), households by tenure (a
 * dimension), an access rate (a weighted mean of population), a median age
 * (not aggregatable), and a rate with confidence intervals. The values are
 * read through the same `ObservationCache` the API uses.
 */

type FixtureRow = [
	code: string,
	period: string,
	value: number,
	extra?: { lower?: number; upper?: number; status?: string },
];

type FixtureSeries = {
	dataset: string;
	measure: string;
	dimensions?: Record<string, string>;
	geography: string;
	rows: FixtureRow[];
};

const GEOGRAPHY = "localAuthority";

export const fixtureSeries: FixtureSeries[] = [
	{
		dataset: "population-fixture",
		measure: "population",
		geography: GEOGRAPHY,
		rows: [
			["E06000001", "2022", 100],
			["E06000002", "2022", 300],
			["E06000003", "2022", 600],
			["E06000001", "2023", 110],
			["E06000002", "2023", 290],
			["E06000003", "2023", 620],
			["E06000004", "2023", 50, { status: "derived" }],
		],
	},
	{
		dataset: "households-fixture",
		measure: "households",
		dimensions: { tenure: "total" },
		geography: GEOGRAPHY,
		rows: [
			["E06000001", "2021", 40],
			["E06000002", "2021", 120],
		],
	},
	{
		dataset: "households-fixture",
		measure: "households",
		dimensions: { tenure: "owned" },
		geography: GEOGRAPHY,
		rows: [
			["E06000001", "2021", 25],
			["E06000002", "2021", 70],
		],
	},
	{
		dataset: "households-fixture",
		measure: "households",
		dimensions: { tenure: "rented" },
		geography: GEOGRAPHY,
		rows: [
			["E06000001", "2021", 15],
			["E06000002", "2021", 50],
		],
	},
	{
		dataset: "access-fixture",
		measure: "access-rate",
		geography: GEOGRAPHY,
		rows: [
			["E06000001", "2023", 50],
			["E06000002", "2023", 100],
			["E06000003", "2023", 80],
			["E06000005", "2023", 70],
		],
	},
	{
		dataset: "age-fixture",
		measure: "median-age",
		geography: GEOGRAPHY,
		rows: [
			["E06000001", "2023", 41.5],
			["E06000002", "2023", 38.2],
		],
	},
	{
		dataset: "rate-fixture",
		measure: "claim-rate",
		geography: GEOGRAPHY,
		rows: [
			["E06000001", "2023", 4.2, { lower: 3.9, upper: 4.5 }],
			["E06000002", "2023", 5.1, { lower: 4.6, upper: 5.6 }],
			["E06000003", "2023", 3.3],
		],
	},
];

const writeDatabase = (path: string, series: FixtureSeries[]) => {
	const database = new DatabaseSync(path);
	database.exec(`
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE area_releases (position INTEGER, geography TEXT, id TEXT);
		CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER);
		CREATE TABLE dimension (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
		CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT);
		CREATE TABLE status (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, lower REAL, upper REAL, status_id INTEGER);
		INSERT INTO area_releases VALUES (0, '${GEOGRAPHY}', '2023-fixture');
	`);
	const ids = new Map<string, number>();
	const idOf = (
		table: string,
		key: string,
		columns: string,
		values: string,
	) => {
		const name = `${table}:${key}`;
		let id = ids.get(name);
		if (id === undefined) {
			id = ids.size + 1;
			ids.set(name, id);
			database
				.prepare(
					`INSERT INTO ${table} (id, ${columns}) VALUES (?, ${values})`,
				)
				.run(id, key);
		}
		return id;
	};
	const versions = new Map<string, number>();
	let seriesId = 0;
	for (const entry of series) {
		seriesId += 1;
		database
			.prepare(
				"INSERT INTO series (id, dataset_id, measure_id, release_id) VALUES (?, ?, ?, 0)",
			)
			.run(
				seriesId,
				idOf("dataset", entry.dataset, "slug", "?"),
				idOf("measure", entry.measure, "slug", "?"),
			);
		for (const [dimension, member] of Object.entries(
			entry.dimensions ?? {},
		))
			database
				.prepare(
					"INSERT INTO series_member (series_id, dimension_id, member_id) VALUES (?, ?, ?)",
				)
				.run(
					seriesId,
					idOf("dimension", dimension, "slug", "?"),
					idOf(
						"dimension_member",
						`${dimension}:${member}`,
						"code",
						"?",
					),
				);
		for (const [code, period, value, extra] of entry.rows) {
			let version = versions.get(code);
			if (version === undefined) {
				const area = idOf("area", code, "code", "?");
				version = area;
				versions.set(code, version);
				database
					.prepare(
						"INSERT INTO area_version (id, area_id, release_id) VALUES (?, ?, 0)",
					)
					.run(version, area);
			}
			database
				.prepare("INSERT INTO observation VALUES (?, ?, ?, ?, ?, ?, ?)")
				.run(
					seriesId,
					version,
					idOf("period", period, "label", "?"),
					value,
					extra?.lower ?? null,
					extra?.upper ?? null,
					idOf("status", extra?.status ?? "observed", "slug", "?"),
				);
		}
	}
	database.close();
};

/** The `dimension_member` rows store `dimension:member`; fix them to the code. */
const normalise = (path: string) => {
	const database = new DatabaseSync(path);
	database.exec(
		"UPDATE dimension_member SET code = substr(code, instr(code, ':') + 1)",
	);
	database.close();
};

const measure = (
	id: string,
	overrides: Partial<Measure> & Pick<Measure, "aggregation">,
	datasetId: string,
	periods: string[],
): Measure =>
	({
		id,
		label: id,
		valueKind: "count",
		unit: "people",
		sources: [
			{
				datasetId,
				periods,
				sourceGeography: { type: GEOGRAPHY, boundaryYear: 2023 },
				coverage: {
					kind: "source-reported",
					countries: ["GB-ENG"],
					recordCount: 0,
					note: "",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: true,
		},
		links: { data: `/v1/data/${id}` },
		...overrides,
	}) as Measure;

export const fixtureCatalog = (): DataCatalog =>
	({
		schemaVersion: 1,
		contentHash: "fixture-catalogue",
		source: {
			artifact: "data/datasets/dataset-manifest.json",
			manifestVersion: 1,
		},
		datasets: [],
		measures: [
			measure(
				"population",
				{
					label: "Population",
					aggregation: {
						kind: "extensive",
						operation: "sum",
						available: true,
					},
				},
				"population-fixture",
				["2022", "2023"],
			),
			...(["total", "owned", "rented"] as const).map((tenure) =>
				measure(
					`households-${tenure}`,
					{
						label: `Households, ${tenure}`,
						unit: "households",
						aggregation: {
							kind: "extensive",
							operation: "sum",
							available: true,
						},
					},
					"households-fixture",
					["2021"],
				),
			),
			measure(
				"access-rate",
				{
					label: "Access rate",
					valueKind: "ratio",
					unit: "% of premises",
					aggregation: {
						kind: "intensive",
						operation: "weighted-mean",
						weight: {
							description: "Population",
							datasetField: "population",
							measureId: "population",
						},
						available: true,
					},
				},
				"access-fixture",
				["2023"],
			),
			measure(
				"median-age",
				{
					label: "Median age",
					valueKind: "quantity",
					unit: "years",
					aggregation: {
						kind: "non-aggregatable",
						statistic: "median",
						note: "A median of medians is not the median of the people.",
						available: false,
					},
				},
				"age-fixture",
				["2023"],
			),
			measure(
				"claim-rate",
				{
					label: "Claim rate",
					valueKind: "ratio",
					unit: "%",
					aggregation: {
						kind: "non-aggregatable",
						statistic: "rank",
						note: "Not combined.",
						available: false,
					},
					uncertainty: {
						kind: "confidence-interval",
						level: 0.95,
						note: "Publisher interval.",
					},
				},
				"rate-fixture",
				["2023"],
			),
		],
	}) as DataCatalog;

export const fixtureDimensions = (): MeasureDimensions => {
	const description = (label: string) => ({
		label,
		description: label,
		unit: "",
		valueKind: "count",
		aggregation: "sum",
	});
	const ids: MeasureDimensions["config"]["ids"] = {
		population: { measure: "population" },
		"access-rate": { measure: "access-rate" },
		"median-age": { measure: "median-age" },
		"claim-rate": { measure: "claim-rate" },
	};
	for (const tenure of ["total", "owned", "rented"])
		ids[`households-${tenure}`] = {
			measure: "households",
			dimensions: { tenure },
		};
	return {
		config: {
			schemaVersion: 1,
			measures: {},
			dimensions: {},
			members: {},
			defaults: {},
			ids,
		},
		vocabulary: {
			schemaVersion: 1,
			measures: {
				population: description("Population"),
				households: description("Households"),
				"access-rate": description("Access rate"),
				"median-age": description("Median age"),
				"claim-rate": description("Claim rate"),
			},
			dimensions: {
				tenure: {
					label: "Tenure",
					members: [
						{ code: "total", label: "All households" },
						{ code: "owned", label: "Owned", parent: "total" },
						{ code: "rented", label: "Rented", parent: "total" },
					],
				},
			},
		},
	};
};

/** A fixture database and the context the shared query reads it through. */
export const createMeasureFixture = (): {
	path: string;
	context: MeasureValuesContext;
	catalog: DataCatalog;
} => {
	const directory = mkdtempSync(join(tmpdir(), "measure-values-"));
	const path = join(directory, "atlas.sqlite");
	writeDatabase(path, fixtureSeries);
	normalise(path);
	const catalog = fixtureCatalog();
	const measureDimensions = fixtureDimensions();
	const statistics: StatisticsReadPath["statistics"] = {};
	const bySeries = (id: string) => {
		const mapped = measureDimensions.config.ids[id]!;
		return fixtureSeries.find(
			(entry) =>
				entry.measure === mapped.measure &&
				JSON.stringify(entry.dimensions ?? {}) ===
					JSON.stringify(mapped.dimensions ?? {}),
		)!;
	};
	for (const entry of catalog.measures) {
		const found = bySeries(entry.id);
		statistics[observationArtifactName(entry.id, entry.sources[0]!)] = {
			datasetId: found.dataset,
			measure: found.measure,
			dimensions: found.dimensions ?? {},
			geography: GEOGRAPHY,
		};
	}
	const readPath: StatisticsReadPath = {
		schemaVersion: 1,
		dataCatalogHash: catalog.contentHash,
		observations: {},
		statistics,
	};
	const cache = new ObservationCache();
	cache.bindCatalogue(path, catalog, readPath);
	return {
		path,
		catalog,
		context: {
			dataCatalog: catalog,
			measureDimensions,
			measureObservations: catalog.measures.map((entry) =>
				lazySourceObservations(
					path,
					observationArtifactName(entry.id, entry.sources[0]!),
					entry.id,
					entry.sources[0]!.sourceGeography,
					cache,
				),
			),
		},
	};
};
