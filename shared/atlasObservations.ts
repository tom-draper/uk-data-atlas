import { observationArtifactName, type DataCatalog } from "./dataCatalog";
import {
	DatabaseSync,
	type SQLInputValue,
	type SQLOutputValue,
} from "node:sqlite";
import { sha256 } from "./contentHash";
import { atlasDatabasePath } from "./dataLayout";

export const observationDatabasePath = (apiRoot: string) =>
	atlasDatabasePath(apiRoot);

/** Read the small inventory without loading observation rows. */
export function readObservationInventory(path: string) {
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		if (
			!database
				.prepare(
					"SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'observation_catalogue'",
				)
				.get()
		)
			throw new Error(
				"Missing SQLite observation catalogue. Run pnpm data:build --from data-catalog.",
			);
		const metadata = database
			.prepare(
				"SELECT dataCatalogHash, generationHash FROM observation_catalogue",
			)
			.get();
		if (
			typeof metadata?.dataCatalogHash !== "string" ||
			typeof metadata?.generationHash !== "string"
		)
			throw new Error(
				"Missing SQLite observation catalogue. Run pnpm data:build --from data-catalog.",
			);
		const names = new Set(
			database
				.prepare("SELECT artifactId FROM observation_series")
				.all()
				.map((row) => String(row.artifactId)),
		);
		return {
			dataCatalogHash: metadata.dataCatalogHash,
			generationHash: metadata.generationHash,
			names,
		};
	} finally {
		database.close();
	}
}

type Row = Record<string, SQLOutputValue>;

/** Names the stored tables give columns and tables, which are interpolated into SQL. */
const safeName = (name: SQLOutputValue) => {
	if (typeof name !== "string" || !/^[a-z0-9_]+$/.test(name))
		throw new Error(
			`Invalid SQLite observation table name: ${String(name)}`,
		);
	return name;
};

/** Every row of a statement, as arrays of its columns. */
function rowsOf(
	database: DatabaseSync,
	sql: string,
	...parameters: SQLInputValue[]
) {
	const statement = database.prepare(sql);
	statement.setReturnArrays(true);
	return statement.all(...parameters) as unknown as SQLOutputValue[][];
}

/** The labels at ids from `low` to `high`, indexed by id. */
function labelsOf(
	database: DatabaseSync,
	table: "observation_areas" | "observation_periods" | "observation_statuses",
	column: "code" | "label",
	low: number,
	high: number,
) {
	const labels: SQLOutputValue[] = [];
	for (const [position, label] of rowsOf(
		database,
		`SELECT position, ${column} FROM ${table} WHERE position BETWEEN ? AND ?`,
		low,
		high,
	))
		labels[Number(position)] = label;
	return labels;
}

/**
 * A measure's own periods, in the order and key order the compilers wrote.
 * Every table is read once in primary key order, so the optional fields are
 * merged in beside their observations rather than joined in row by row.
 */
function measurePeriods(database: DatabaseSync, seriesId: SQLOutputValue) {
	const sparse = (table: string, columns: string) =>
		rowsOf(
			database,
			`SELECT periodId, areaId, ${columns} FROM ${table} WHERE seriesId = ? ORDER BY periodId, areaId`,
			seriesId as SQLInputValue,
		);
	const rows = rowsOf(
		database,
		"SELECT periodId, areaId, value, statusId FROM observations WHERE seriesId = ? ORDER BY periodId, areaId",
		seriesId as SQLInputValue,
	);
	const sourceAreas = sparse("observation_source_areas", "sourceAreaId");
	const categories = sparse("observation_categories", "category");
	const intervals = sparse("observation_intervals", "lower, upper");
	let lowest = Infinity;
	let highest = -Infinity;
	const widen = (id: SQLOutputValue) => {
		lowest = Math.min(lowest, Number(id));
		highest = Math.max(highest, Number(id));
	};
	for (const row of rows) widen(row[1]);
	for (const row of sourceAreas) widen(row[2]);
	const areas = labelsOf(
		database,
		"observation_areas",
		"code",
		lowest,
		highest,
	);
	const periodLabels = labelsOf(
		database,
		"observation_periods",
		"label",
		0,
		Number.MAX_SAFE_INTEGER,
	);
	const statuses = labelsOf(
		database,
		"observation_statuses",
		"label",
		0,
		Number.MAX_SAFE_INTEGER,
	);
	const next = { source: 0, category: 0, interval: 0 };
	const matching = (
		side: SQLOutputValue[][],
		at: "source" | "category" | "interval",
		row: SQLOutputValue[],
	) => {
		const candidate = side[next[at]];
		if (candidate?.[0] !== row[0] || candidate[1] !== row[1])
			return undefined;
		next[at]++;
		return candidate;
	};
	const periods: Array<{ period: unknown; records: object[] }> = [];
	let current: (typeof periods)[number] | undefined;
	let periodId: SQLOutputValue = null;
	for (const row of rows) {
		if (row[0] !== periodId || !current) {
			periodId = row[0];
			current = { period: periodLabels[Number(periodId)], records: [] };
			periods.push(current);
		}
		const source = matching(sourceAreas, "source", row);
		const category = matching(categories, "category", row);
		const interval = matching(intervals, "interval", row);
		const record: Record<string, unknown> = {
			areaCode: areas[Number(row[1])],
		};
		if (source) record.sourceAreaCode = areas[Number(source[2])];
		if (category) record.category = category[2];
		else record.value = row[2];
		record.status = statuses[Number(row[3])];
		if (interval)
			record.confidenceInterval = {
				lower: interval[2],
				upper: interval[3],
			};
		current.records.push(record);
	}
	return periods;
}

/** A shared table's rows, one per area, with a value for each measure it serves. */
function tableRecords(
	database: DatabaseSync,
	seriesId: SQLOutputValue,
	valueTable: SQLOutputValue,
) {
	const columns = database
		.prepare(
			"SELECT m.measureId, c.columnName FROM observation_table_columns c JOIN observation_measures m ON m.position = c.measurePosition WHERE c.seriesPosition = ? ORDER BY c.ordinal",
		)
		.all(seriesId) as Row[];
	const select = database.prepare(
		`SELECT ${["a.code", ...columns.map((column) => `t."${safeName(column.columnName)}"`)].join(", ")} FROM ${safeName(valueTable)} t JOIN observation_areas a ON a.position = t.areaId ORDER BY t.position`,
	);
	select.setReturnArrays(true);
	return {
		measures: columns.map((column) => column.measureId),
		records: select.all() as unknown as unknown[][],
	};
}

/**
 * The text an artifact was stored from, rebuilt from its rows, with the hash
 * of the text it was stored from. Absent when no such artifact is stored.
 */
export function rebuildObservationText(database: DatabaseSync, id: string) {
	const series = database
		.prepare(
			"SELECT s.position, s.measurePosition, m.measureId, s.geographyType, s.boundaryYear, s.contentHash, s.payloadHash, t.datasetId, t.period, t.valueTable FROM observation_series s LEFT JOIN observation_measures m ON m.position = s.measurePosition LEFT JOIN observation_tables t ON t.seriesPosition = s.position WHERE s.artifactId = ?",
		)
		.get(id);
	if (!series) return undefined;
	const sourceGeography = {
		type: series.geographyType,
		boundaryYear: series.boundaryYear,
	};
	const artifact =
		series.valueTable === null
			? {
					schemaVersion: 1,
					contentHash: series.contentHash,
					measureId: series.measureId,
					sourceGeography,
					periods: measurePeriods(database, series.position),
				}
			: {
					schemaVersion: 1,
					kind: "measure-table",
					id,
					datasetId: series.datasetId,
					sourceGeography,
					period: series.period,
					...tableRecords(
						database,
						series.position,
						series.valueTable,
					),
					contentHash: series.contentHash,
				};
	return {
		text: `${JSON.stringify(artifact)}\n`,
		payloadHash: series.payloadHash,
	};
}

/** Exact artifact bytes are shared by query views and JSON/CSV/Parquet exports. */
export function readObservationText(
	path: string,
	id: string,
	expectedGeneration?: string,
): string {
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		if (
			expectedGeneration !== undefined &&
			database
				.prepare("SELECT generationHash FROM observation_catalogue")
				.get()?.generationHash !== expectedGeneration
		)
			throw new Error(
				"SQLite observations changed while serving. Restart the API after the data build.",
			);
		const stored = rebuildObservationText(database, id);
		if (!stored)
			throw new Error(`Missing SQLite measure observations: ${id}`);
		if (sha256(stored.text) !== stored.payloadHash)
			throw new Error(`Corrupt SQLite measure observations: ${id}`);
		return stored.text;
	} finally {
		database.close();
	}
}

export function assertObservationCatalogue(path: string, catalog: DataCatalog) {
	const inventory = readObservationInventory(path);
	if (inventory.dataCatalogHash !== catalog.contentHash)
		throw new Error(
			"SQLite observations were compiled from another data catalogue. Run pnpm data:build --from data-catalog.",
		);
	for (const measure of catalog.measures)
		for (const source of measure.sources) {
			const id = observationArtifactName(measure.id, source);
			if (!inventory.names.has(id))
				throw new Error(`Missing SQLite measure observations: ${id}`);
		}
	return inventory;
}
