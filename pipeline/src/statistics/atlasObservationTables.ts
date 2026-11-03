import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { observationArtifactName } from "@uk-data-atlas/measures";
import { rebuildObservationText } from "@uk-data-atlas/atlas-runtime/storage";
import { sha256 } from "@uk-data-atlas/artifacts";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
	MeasureObservation,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	isMeasureTable,
	type MeasureTableArtifact,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { writeSqliteTables, type SqliteTable } from "@uk-data-atlas/artifacts";

/**
 * Observation artifacts stored as rows. The artifact text is not kept: the
 * reader rebuilds it, byte for byte, from `observation_series` and the rows
 * it owns. Area codes, periods and statuses are small dictionaries whose ids
 * follow sort order, so a series reads back in the order it was written
 * without a sort. A shared census table keeps its own table of values, one
 * row per area, as the publisher's table has one column per measure.
 *
 * Only the shapes below are representable, in the key order the compilers
 * write. Anything else is refused when stored, since the API serves the
 * artifact's exact bytes and its content hash depends on them.
 */

/** Ids are positions: `observed` is 0 and `derived` is 1, which SQLite stores without a body byte. */
const STATUSES = ["observed", "derived"];

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const identifier = (text: string) =>
	text.toLowerCase().replace(/[^a-z0-9]+/g, "_");

type MeasureSeries = {
	id: string;
	text: string;
	artifact: AnyMeasureObservationArtifact;
};
type TableSeries = { id: string; text: string; artifact: MeasureTableArtifact };

const recordKeys = (record: object) => [
	"areaCode",
	...("sourceAreaCode" in record ? ["sourceAreaCode"] : []),
	"category" in record ? "category" : "value",
	"status",
	...("confidenceInterval" in record ? ["confidenceInterval"] : []),
];

/** The tables holding these artifacts, keyed by name in creation order. */
export const observationTables = (
	entries: ReadonlyArray<readonly [id: string, text: string]>,
	catalog?: DataCatalog,
): Record<string, SqliteTable> => {
	const catalogMeasures = new Map(
		catalog?.measures.map((measure) => [measure.id, measure]),
	);
	const sourceDatasets = new Map(
		catalog?.measures.flatMap((measure) =>
			measure.sources.map(
				(source) =>
					[
						observationArtifactName(measure.id, source),
						source.datasetId,
					] as const,
			),
		),
	);
	const measureSeries: MeasureSeries[] = [];
	const tableSeries: TableSeries[] = [];
	const series: Array<MeasureSeries | TableSeries> = [];
	for (const [id, text] of [...entries].sort(([a], [b]) => compare(a, b))) {
		const artifact = JSON.parse(text);
		if (isMeasureTable(artifact)) {
			if (artifact.id !== id)
				throw new Error(
					`Observation table ${id} names itself ${artifact.id}`,
				);
			tableSeries.push({ id, text, artifact });
			series.push(tableSeries.at(-1)!);
		} else if (
			artifact?.schemaVersion === 1 &&
			typeof artifact.measureId === "string" &&
			Array.isArray(artifact.periods)
		) {
			measureSeries.push({ id, text, artifact });
			series.push(measureSeries.at(-1)!);
		} else
			throw new Error(`Observation artifact ${id} has an unknown shape`);
	}
	const seriesPositions = new Map(
		series.map(({ id }, position) => [id, position]),
	);

	const measureIds = new Set<string>();
	const periods = new Set<string>();
	const codes = new Set<string>();
	for (const { artifact } of measureSeries) {
		measureIds.add(artifact.measureId);
		for (const period of artifact.periods) {
			periods.add(period.period);
			for (const record of period.records) {
				codes.add(record.areaCode);
				if (record.sourceAreaCode !== undefined)
					codes.add(record.sourceAreaCode);
			}
		}
	}
	for (const { artifact } of tableSeries) {
		for (const measureId of artifact.measures) measureIds.add(measureId);
		for (const [code] of artifact.records) codes.add(code);
	}
	const measures = [...measureIds].sort(compare);
	const periodLabels = [...periods].sort(compare);
	const areas = [...codes].sort(compare);
	const measurePositions = new Map(
		measures.map((id, position) => [id, position]),
	);
	const periodIds = new Map(
		periodLabels.map((label, position) => [label, position]),
	);
	const areaIds = new Map(areas.map((code, position) => [code, position]));
	const statusIds = new Map(
		STATUSES.map((label, position) => [label, position]),
	);

	/** Every record, in the order its series must read back, with its dictionary ids. */
	function* records({ id, artifact }: MeasureSeries) {
		let previousPeriod = -1;
		for (const period of artifact.periods) {
			const periodId = periodIds.get(period.period)!;
			if (periodId <= previousPeriod)
				throw new Error(
					`Observation artifact ${id} periods are not in ascending order`,
				);
			previousPeriod = periodId;
			let previousArea = -1;
			for (const record of period.records as MeasureObservation[]) {
				const statusId = statusIds.get(record.status);
				const interval = (record as { confidenceInterval?: unknown })
					.confidenceInterval;
				const areaId = areaIds.get(record.areaCode)!;
				if (
					statusId === undefined ||
					Object.keys(record).join() !== recordKeys(record).join() ||
					(interval !== undefined &&
						Object.keys(interval as object).join() !==
							"lower,upper")
				)
					throw new Error(
						`Observation artifact ${id} has a record that cannot be stored as a row`,
					);
				if (areaId <= previousArea)
					throw new Error(
						`Observation artifact ${id} records are not in ascending area code order`,
					);
				previousArea = areaId;
				yield { periodId, areaId, statusId, record };
			}
		}
	}

	const slugs = new Set<string>();
	const cellTables = tableSeries.map(({ id, artifact }) => {
		const name = `observation_${identifier(id)}`;
		const columns = artifact.measures.map(identifier);
		if (
			slugs.has(name) ||
			new Set(columns).size !== columns.length ||
			columns.some((column) => !column)
		)
			throw new Error(
				`Observation table ${id} has colliding SQLite names`,
			);
		slugs.add(name);
		return { name, columns };
	});

	const censusSelects = tableSeries.flatMap(({ id, artifact }, index) =>
		cellTables[index]!.columns.map(
			(column, ordinal) =>
				`SELECT s.artifactId, m.measureId, s.geographyType, s.boundaryYear, meta.period, a.code AS areaCode, NULL AS sourceAreaCode, t."${column}" AS value, NULL AS category, NULL AS status, NULL AS confidenceLower, NULL AS confidenceUpper FROM ${cellTables[index]!.name} t JOIN observation_areas a ON a.position = t.areaId JOIN observation_series s ON s.position = ${seriesPositions.get(id)!} JOIN observation_tables meta ON meta.seriesPosition = s.position JOIN observation_measures m ON m.position = ${measurePositions.get(artifact.measures[ordinal]!)!}`,
		),
	);
	const keyColumns = [
		"seriesId INTEGER NOT NULL REFERENCES observation_series(position)",
		"periodId INTEGER NOT NULL REFERENCES observation_periods(position)",
		"areaId INTEGER NOT NULL REFERENCES observation_areas(position)",
	];
	const key = ["seriesId", "periodId", "areaId"];
	/** A table of the records that carry something the main row has no column for. */
	const sparse = (
		columns: string[],
		select: (record: MeasureObservation) => SQLInputValue[] | undefined,
	): SqliteTable => ({
		columns: [...keyColumns, ...columns],
		key,
		strict: true,
		rows: (function* () {
			for (const item of measureSeries)
				for (const { periodId, areaId, record } of records(item)) {
					const values = select(record);
					if (values)
						yield [
							seriesPositions.get(item.id)!,
							periodId,
							areaId,
							...values,
						];
				}
		})(),
	});

	return {
		observation_statuses: {
			columns: ["label TEXT NOT NULL UNIQUE"],
			strict: true,
			rows: STATUSES.map((label) => [label]),
		},
		observation_periods: {
			columns: ["label TEXT NOT NULL UNIQUE"],
			strict: true,
			rows: periodLabels.map((label) => [label]),
		},
		// No index on code: ids are looked up by position, and a direct query by code is a scan of a few tens of thousands of rows.
		observation_areas: {
			columns: ["code TEXT NOT NULL"],
			strict: true,
			rows: areas.map((code) => [code]),
		},
		observation_measures: {
			columns: [
				"measureId TEXT NOT NULL UNIQUE",
				"label TEXT",
				"unit TEXT",
				"valueKind TEXT",
				"concept TEXT",
				"aggregationKind TEXT",
				"aggregationOperation TEXT",
				"aggregationAvailable INTEGER",
				"aggregationStatistic TEXT",
				"aggregationNote TEXT",
				"weightDescription TEXT",
				"weightDatasetField TEXT",
				"weightMeasureId TEXT",
				"uncertaintyKind TEXT",
				"uncertaintyLevel REAL",
				"uncertaintyNote TEXT",
			],
			strict: true,
			rows: measures.map((id) => {
				const measure = catalogMeasures.get(id);
				const aggregation = measure?.aggregation;
				const weight =
					aggregation && "weight" in aggregation
						? aggregation.weight
						: undefined;
				return [
					id,
					measure?.label ?? null,
					measure?.unit ?? null,
					measure?.valueKind ?? null,
					measure?.concept ?? null,
					aggregation?.kind ?? null,
					aggregation && "operation" in aggregation
						? aggregation.operation
						: null,
					aggregation ? Number(aggregation.available) : null,
					aggregation && "statistic" in aggregation
						? aggregation.statistic
						: null,
					aggregation && "note" in aggregation
						? aggregation.note
						: null,
					weight?.description ?? null,
					weight?.datasetField ?? null,
					weight?.measureId ?? null,
					measure?.uncertainty?.kind ?? null,
					measure?.uncertainty?.level ?? null,
					measure?.uncertainty?.note ?? null,
				];
			}),
		},
		observation_datasets: {
			columns: [
				"datasetId TEXT NOT NULL UNIQUE",
				"label TEXT",
				"publisher TEXT",
				"sourceUrl TEXT",
				"temporalCoverage TEXT",
				"licenceName TEXT",
				"licenceUrl TEXT",
				"description TEXT",
			],
			strict: true,
			rows: (catalog?.datasets ?? []).map((dataset) => [
				dataset.id,
				dataset.label,
				dataset.publisher,
				dataset.sourceUrl,
				dataset.temporalCoverage,
				dataset.licence.name,
				dataset.licence.url ?? null,
				dataset.description ?? null,
			]),
		},
		observation_series: {
			columns: [
				"artifactId TEXT NOT NULL UNIQUE",
				"datasetId TEXT",
				"measurePosition INTEGER REFERENCES observation_measures(position)",
				"geographyType TEXT NOT NULL",
				"boundaryYear INTEGER NOT NULL",
				"contentHash TEXT NOT NULL",
				"payloadHash TEXT NOT NULL",
			],
			strict: true,
			rows: series.map((item) => [
				item.id,
				"datasetId" in item.artifact
					? item.artifact.datasetId
					: (sourceDatasets.get(item.id) ?? null),
				"measureId" in item.artifact
					? measurePositions.get(item.artifact.measureId)!
					: null,
				item.artifact.sourceGeography.type,
				item.artifact.sourceGeography.boundaryYear,
				item.artifact.contentHash,
				sha256(item.text),
			]),
		},
		observation_tables: {
			columns: [
				"seriesPosition INTEGER NOT NULL REFERENCES observation_series(position)",
				"datasetId TEXT NOT NULL",
				"period TEXT NOT NULL",
				"valueTable TEXT NOT NULL UNIQUE",
			],
			key: ["seriesPosition"],
			strict: true,
			rows: tableSeries.map(({ id, artifact }, index) => [
				seriesPositions.get(id)!,
				artifact.datasetId,
				artifact.period,
				cellTables[index]!.name,
			]),
		},
		observation_table_columns: {
			columns: [
				"seriesPosition INTEGER NOT NULL REFERENCES observation_series(position)",
				"ordinal INTEGER NOT NULL",
				"measurePosition INTEGER NOT NULL REFERENCES observation_measures(position)",
				"columnName TEXT NOT NULL",
			],
			key: ["seriesPosition", "ordinal"],
			strict: true,
			rows: (function* () {
				for (const [index, { id, artifact }] of tableSeries.entries())
					for (const [
						ordinal,
						measureId,
					] of artifact.measures.entries())
						yield [
							seriesPositions.get(id)!,
							ordinal,
							measurePositions.get(measureId)!,
							cellTables[index]!.columns[ordinal]!,
						];
			})(),
		},
		observations: {
			indexes: [["areaId", "seriesId", "periodId"]],
			columns: [
				...keyColumns,
				"value REAL",
				"statusId INTEGER NOT NULL REFERENCES observation_statuses(position)",
			],
			key,
			strict: true,
			rows: (function* () {
				for (const item of measureSeries)
					for (const {
						periodId,
						areaId,
						statusId,
						record,
					} of records(item))
						yield [
							seriesPositions.get(item.id)!,
							periodId,
							areaId,
							"value" in record ? record.value : null,
							statusId,
						];
			})(),
			views: {
				observations_census: censusSelects.length
					? censusSelects.join(" UNION ALL ")
					: "SELECT * FROM observations_decoded WHERE 0",
				observations_all:
					"SELECT * FROM observations_decoded UNION ALL SELECT * FROM observations_census",
				observations_decoded: `SELECT s.artifactId, m.measureId, s.geographyType, s.boundaryYear, p.label AS period, a.code AS areaCode, sa.code AS sourceAreaCode, o.value, c.category, st.label AS status, i.lower AS confidenceLower, i.upper AS confidenceUpper FROM observations o JOIN observation_series s ON s.position = o.seriesId JOIN observation_measures m ON m.position = s.measurePosition JOIN observation_periods p ON p.position = o.periodId JOIN observation_areas a ON a.position = o.areaId JOIN observation_statuses st ON st.position = o.statusId LEFT JOIN observation_source_areas x ON x.seriesId = o.seriesId AND x.periodId = o.periodId AND x.areaId = o.areaId LEFT JOIN observation_areas sa ON sa.position = x.sourceAreaId LEFT JOIN observation_categories c ON c.seriesId = o.seriesId AND c.periodId = o.periodId AND c.areaId = o.areaId LEFT JOIN observation_intervals i ON i.seriesId = o.seriesId AND i.periodId = o.periodId AND i.areaId = o.areaId`,
			},
		},
		observation_intervals: sparse(
			["lower REAL NOT NULL", "upper REAL NOT NULL"],
			(record) => {
				const interval = (
					record as {
						confidenceInterval?: { lower: number; upper: number };
					}
				).confidenceInterval;
				return interval && [interval.lower, interval.upper];
			},
		),
		observation_source_areas: sparse(
			[
				"sourceAreaId INTEGER NOT NULL REFERENCES observation_areas(position)",
			],
			(record) =>
				record.sourceAreaCode === undefined
					? undefined
					: [areaIds.get(record.sourceAreaCode)!],
		),
		observation_categories: sparse(["category TEXT NOT NULL"], (record) =>
			"category" in record ? [record.category] : undefined,
		),
		...Object.fromEntries(
			tableSeries.map(({ id, artifact }, index) => {
				const { name, columns } = cellTables[index]!;
				return [
					name,
					{
						columns: [
							"position INTEGER NOT NULL",
							"areaId INTEGER NOT NULL REFERENCES observation_areas(position)",
							...columns.map((column) => `"${column}" REAL`),
						],
						key: ["position"],
						strict: true,
						rows: (function* () {
							for (const [
								position,
								[code, ...values],
							] of artifact.records.entries()) {
								if (
									values.length !== columns.length ||
									values.some(
										(value) =>
											value !== null &&
											typeof value !== "number",
									)
								)
									throw new Error(
										`Observation table ${id} has a malformed row`,
									);
								yield [position, areaIds.get(code)!, ...values];
							}
						})(),
						views: {
							[`${name}_decoded`]: `SELECT t.position, a.code AS areaCode, ${columns.map((column) => `t."${column}"`).join(", ")} FROM ${name} t JOIN observation_areas a ON a.position = t.areaId`,
						},
					} satisfies SqliteTable,
				];
			}),
		),
	};
};

/**
 * Replace every observation table in the database with these artifacts, and
 * check that each reads back to exactly the text it was given.
 */
export const replaceObservationTables = (
	database: DatabaseSync,
	entries: ReadonlyArray<readonly [id: string, text: string]>,
	catalog?: DataCatalog,
) => {
	const tables = observationTables(entries, catalog);
	// Foreign keys are checked once at the end rather than for every row.
	database.exec("PRAGMA foreign_keys = OFF; BEGIN");
	try {
		const owned = new Set([
			"observation_artifacts",
			"observation_statuses",
			"observation_periods",
			"observation_areas",
			"observation_measures",
			"observation_datasets",
			"observation_series",
			"observation_tables",
			"observation_table_columns",
			"observations",
			"observation_intervals",
			"observation_source_areas",
			"observation_categories",
			"observations_decoded",
			"observations_census",
			"observations_all",
			...Object.keys(tables),
			...Object.values(tables).flatMap((table) =>
				Object.keys(table.views ?? {}),
			),
		]);
		if (
			database
				.prepare(
					"SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'observation_tables'",
				)
				.get()
		) {
			for (const row of database
				.prepare("SELECT valueTable FROM observation_tables")
				.all()) {
				const name = String(row.valueTable);
				if (/^observation_[a-z0-9_]+$/.test(name)) {
					owned.add(name);
					owned.add(`${name}_decoded`);
				}
			}
		}
		const stale = database
			.prepare(
				"SELECT type, name FROM sqlite_master WHERE type IN ('table', 'view')",
			)
			.all() as Array<{ type: string; name: string }>;
		for (const { type, name } of stale
			.filter(({ name }) => owned.has(name))
			.sort((a, b) => b.type.localeCompare(a.type)))
			database.exec(`DROP ${type} "${name}"`);
		writeSqliteTables(database, tables);
		for (const [id, text] of entries)
			if (rebuildObservationText(database, id)?.text !== text)
				throw new Error(
					`Observation artifact ${id} cannot be stored as rows without changing its bytes`,
				);
		if (database.prepare("PRAGMA foreign_key_check").all().length)
			throw new Error("Observation tables reference missing rows");
		database.exec("COMMIT");
	} catch (error) {
		database.exec("ROLLBACK");
		throw error;
	} finally {
		database.exec("PRAGMA foreign_keys = ON");
	}
};
