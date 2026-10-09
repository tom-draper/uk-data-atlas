import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	AnyMeasureObservationArtifact,
	PopulationObservation,
	SourceGeography,
} from "./dataCatalog";

/**
 * Several measures' observations for one source partition and period, stored
 * once. A census table publishes every category for every area, so writing
 * each category as its own artifact would repeat every area code once per
 * category; a table keeps one row per area with a value per measure.
 */
export type MeasureTableArtifact = {
	schemaVersion: 1;
	kind: "measure-table";
	contentHash: string;
	/** The artifact's own name, which every measure it serves names. */
	id: string;
	datasetId: string;
	sourceGeography: SourceGeography;
	period: string;
	/** The measure each value column serves, in column order. */
	measures: string[];
	/** An area code, then one value per measure; null where none is published. */
	records: Array<[string, ...Array<number | null>]>;
};

export const isMeasureTable = (
	artifact: unknown,
): artifact is MeasureTableArtifact =>
	typeof artifact === "object" &&
	artifact !== null &&
	(artifact as { kind?: unknown }).kind === "measure-table";

/** The table each measure's view was taken from. */
const tableOfView = new WeakMap<object, MeasureTableArtifact>();

/** What each lazily read view reads, and so stands for, when asked. */
const loaderOfView = new WeakMap<object, () => AnyMeasureObservationArtifact>();

type RecordLookup = (areaCode: string) => PopulationObservation | undefined;

/** The lookup each view's period offers, keyed by the period object. */
const lookupOfPeriod = new WeakMap<object, RecordLookup>();

/** Each table's rows by area code, built the first time any measure asks. */
const rowsByCode = new WeakMap<
	MeasureTableArtifact,
	Map<string, MeasureTableArtifact["records"][number]>
>();

const rowsOf = (table: MeasureTableArtifact) => {
	let rows = rowsByCode.get(table);
	if (!rows) {
		rows = new Map();
		// The first row for a code wins, as a scan of the records would find it.
		for (const row of table.records)
			if (!rows.has(row[0])) rows.set(row[0], row);
		rowsByCode.set(table, rows);
	}
	return rows;
};

/**
 * The table a measure's observations were read from, where they came from
 * one: a download of them is the whole table, which is the artifact read.
 */
export const observationTableOf = (
	artifact: object,
): MeasureTableArtifact | undefined =>
	tableOfView.get(loaderOfView.get(artifact)?.() ?? artifact);

/**
 * The record a view's period holds for an area, read from the table's rows
 * without building the period's records. Absent for a period that was not
 * taken from a table, whose records are already an array to search.
 */
export const periodRecordLookup = (period: object): RecordLookup | undefined =>
	lookupOfPeriod.get(period);

/**
 * One measure's observations as a table serves them, shaped like any other
 * observation artifact. The records are built only when first read, so a
 * server holding many tables spends memory only on the measures it is asked
 * for; the content hash is the table's, since that is the artifact read.
 */
export const tableMeasureObservations = (
	table: MeasureTableArtifact,
	measureId: string,
): AnyMeasureObservationArtifact => {
	const column = table.measures.indexOf(measureId);
	if (column === -1)
		throw new Error(`${table.id} does not serve ${measureId}`);
	let records: PopulationObservation[] | undefined;
	const period = {
		period: table.period,
		get records() {
			records ??= table.records.flatMap(([areaCode, ...values]) => {
				const value = values[column];
				return typeof value === "number"
					? [{ areaCode, value, status: "observed" as const }]
					: [];
			});
			return records;
		},
	};
	lookupOfPeriod.set(period, (areaCode) => {
		const value = rowsOf(table).get(areaCode)?.[column + 1];
		return typeof value === "number"
			? { areaCode, value, status: "observed" }
			: undefined;
	});
	const view: AnyMeasureObservationArtifact = {
		schemaVersion: 1,
		contentHash: table.contentHash,
		measureId,
		sourceGeography: table.sourceGeography,
		periods: [period],
	};
	tableOfView.set(view, table);
	return view;
};

/**
 * Read the observations a measure source names from the public directory,
 * whether the artifact is the measure's own or a table it shares. Tables are
 * read once per cache, however many of their measures are asked for.
 */
export const readSourceObservations = (
	publicDirectory: string,
	artifactName: string,
	measureId: string,
	tables: Map<string, MeasureTableArtifact> = new Map(),
): AnyMeasureObservationArtifact => {
	const cached = tables.get(artifactName);
	if (cached) return tableMeasureObservations(cached, measureId);
	const parsed = JSON.parse(
		readFileSync(join(publicDirectory, `${artifactName}.json`), "utf8"),
	) as unknown;
	if (isMeasureTable(parsed)) {
		tables.set(artifactName, parsed);
		return tableMeasureObservations(parsed, measureId);
	}
	return parsed as AnyMeasureObservationArtifact;
};

/**
 * A measure source's observations that are read when first used, shaped like
 * the artifact they stand for. What the catalogue already says (the measure
 * and the source's geography) is held up front, so finding the artifact for a
 * request reads nothing; its content hash and periods read the file, once.
 * Reading every artifact before listening cost seconds of start-up and held
 * every measure in memory, though a request touches few of them. A missing
 * file still stops the server starting; one that is malformed or does not
 * match the catalogue is refused when read.
 */
export const lazySourceObservations = (
	publicDirectory: string,
	artifactName: string,
	measureId: string,
	sourceGeography: SourceGeography,
	tables: Map<string, MeasureTableArtifact> = new Map(),
): AnyMeasureObservationArtifact => {
	const path = join(publicDirectory, `${artifactName}.json`);
	if (!existsSync(path))
		throw new Error(`Missing measure observations at ${path}`);
	let loaded: AnyMeasureObservationArtifact | undefined;
	const load = () => {
		if (loaded) return loaded;
		const observations = readSourceObservations(
			publicDirectory,
			artifactName,
			measureId,
			tables,
		);
		if (
			observations.schemaVersion !== 1 ||
			observations.measureId !== measureId ||
			observations.sourceGeography.type !== sourceGeography.type ||
			observations.sourceGeography.boundaryYear !==
				sourceGeography.boundaryYear ||
			!Array.isArray(observations.periods)
		)
			throw new Error(`Invalid measure observations at ${path}`);
		loaded = observations;
		return loaded;
	};
	// Keys are in an artifact's own order, which its content hash depends on
	// where the artifact is hashed as it was written.
	const view: AnyMeasureObservationArtifact = {
		schemaVersion: 1,
		get contentHash() {
			return load().contentHash;
		},
		measureId,
		get sourceGeography() {
			return loaded?.sourceGeography ?? sourceGeography;
		},
		get periods() {
			return load().periods;
		},
	} as AnyMeasureObservationArtifact;
	loaderOfView.set(view, load);
	return view;
};
