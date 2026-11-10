import type {
	StatisticsArtifact,
	StatisticsReadPath,
	StatisticsSelector,
	StatisticsTableSelector,
} from "./atlasStatisticsObservations.ts";
import { readStatisticsObservationText } from "./atlasStatisticsObservations.ts";
import {
	databaseGeneration,
	openReadOnlyDatabase,
} from "@uk-data-atlas/atlas-db";
import {
	measureSeriesSourceKey,
	observationArtifactName,
} from "./index.ts";
import type {
	DataCatalog,
	AnyMeasureObservationArtifact,
	MeasureObservationArtifact,
	PopulationObservation,
	SourceGeography,
	MeasureSeriesIdentity,
} from "./index.ts";

import { isMeasureTable, type MeasureTableArtifact } from "./measureTable.ts";

/** The table each measure's view was taken from. */
const tableOfView = new WeakMap<object, MeasureTableArtifact>();

/** What each lazily read view reads, and so stands for, when asked. */
const loaderOfView = new WeakMap<object, () => AnyMeasureObservationArtifact>();
const textOfView = new WeakMap<object, () => string>();

/** Exact stored bytes for a lazy SQLite artifact, including shared tables. */
export const observationTextOf = (artifact: object): string | undefined =>
	textOfView.get(artifact)?.();

import { registerPeriodRecordLookup } from "./index.ts";

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
 * One measure's observations as a table serves them, shaped like any other
 * observation artifact. The records are built only when first read, so a
 * server holding many tables spends memory only on the measures it is asked
 * for; the content hash is the table's, since that is the artifact read.
 */
export const tableMeasureObservations = (
	table: MeasureTableArtifact,
	measureId: string,
): MeasureObservationArtifact => {
	const column = table.measures.indexOf(measureId);
	if (column === -1)
		throw new Error(`${table.id} does not serve ${measureId}`);
	let records: PopulationObservation[] | undefined;
	const period = {
		period: table.period,
		get records() {
			if (!records) {
				const materialised: PopulationObservation[] = [];
				for (const row of table.records) {
					const value = row[column + 1];
					if (typeof value === "number")
						materialised.push({
							areaCode: row[0],
							value,
							status: "observed",
						});
				}
				records = materialised;
			}
			return records;
		},
	};
	registerPeriodRecordLookup(period, (areaCode) => {
		const value = rowsOf(table).get(areaCode)?.[column + 1];
		return typeof value === "number"
			? { areaCode, value, status: "observed" }
			: undefined;
	});
	const view: MeasureObservationArtifact = {
		schemaVersion: 1,
		contentHash: table.contentHash,
		measureId,
		sourceGeography: table.sourceGeography,
		periods: [period],
	};
	tableOfView.set(view, table);
	return view;
};

export const DEFAULT_OBSERVATION_CACHE_BYTES = 64 * 1024 * 1024;

type ObservationCacheEntry = {
	text: string;
	artifact?: MeasureTableArtifact | AnyMeasureObservationArtifact;
	views: Map<string, AnyMeasureObservationArtifact>;
	bytes: number;
};

/** Budgets retained UTF-16 text plus the source JSON byte allowance for parsed views. */
export class ObservationCache {
	private readonly entries = new Map<string, ObservationCacheEntry>();
	private bytes = 0;
	/** The generation of each database the entries were read from. */
	private readonly generations = new Map<string, number>();

	/** Artifacts read from the statistics tables, with what the catalogue says of each. */
	private readonly statistics = new Map<
		string,
		{
			selector: StatisticsSelector | StatisticsTableSelector;
			artifact: StatisticsArtifact;
		}
	>();

	private readonly maxBytes: typeof DEFAULT_OBSERVATION_CACHE_BYTES;
	constructor(maxBytes = DEFAULT_OBSERVATION_CACHE_BYTES) {
		this.maxBytes = maxBytes;

		if (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
			throw new Error(
				"Observation cache bytes must be a non-negative safe integer",
			);
	}

	bindCatalogue(
		databasePath: string,
		catalog: DataCatalog,
		readPath: StatisticsReadPath,
		identities?: Readonly<Record<string, MeasureSeriesIdentity>>,
	) {
		if (readPath.dataCatalogHash !== catalog.contentHash)
			throw new Error(
				"Statistics selectors do not match the data catalogue.",
			);
		const database = openReadOnlyDatabase(databasePath);
		try {
			const tables = database
				.prepare(
					"SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('series', 'observation')",
				)
				.all();
			if (tables.length !== 2)
				throw new Error("Missing statistics tables in atlas database.");
		} finally {
			database.release();
		}
		if (Object.keys(readPath.observations).length)
			throw new Error(
				"The statistics read path contains unsupported observation artifacts.",
			);
		const names = new Set<string>();
		const seriesKeys = new Set<string>();
		const canonical = Boolean(
			readPath.series &&
			(identities || catalog.measures.some((measure) => measure.series)),
		);
		for (const measure of catalog.measures)
			for (const source of measure.sources) {
				const name = observationArtifactName(measure.id, source);
				const identity = measure.series ?? identities?.[measure.id];
				if (canonical && !identity)
					throw new Error(
						`Missing series identity for ${measure.id}.`,
					);
				const key =
					identity && measureSeriesSourceKey(identity, source);
				const selector =
					canonical && key
						? readPath.series?.[key]
						: readPath.statistics?.[name];
				if (!selector)
					throw new Error(
						`Missing statistics selector for ${key ?? name}.`,
					);
				if (canonical && key) seriesKeys.add(key);
				names.add(name);
				const cacheKey = canonical && key ? key : name;
				this.statistics.set(`${databasePath}:${cacheKey}`, {
					selector,
					artifact: {
						measureId: measure.id,
						sourceGeography: source.sourceGeography,
						periods: source.periods,
					},
				});
			}
		for (const name of Object.keys(readPath.statistics ?? {}))
			if (!names.has(name))
				throw new Error(`Unexpected statistics selector: ${name}.`);
		if (readPath.series && canonical)
			for (const key of Object.keys(readPath.series))
				if (!seriesKeys.has(key))
					throw new Error(
						`Unexpected statistics series selector: ${key}.`,
					);
	}

	/** Whether an artifact is read from the statistics tables. */
	readsStatistics(databasePath: string, artifactName: string) {
		return this.statistics.has(`${databasePath}:${artifactName}`);
	}

	has(databasePath: string, artifactName: string): boolean {
		return this.statistics.has(`${databasePath}:${artifactName}`);
	}

	text(databasePath: string, artifactName: string): string {
		return this.entry(databasePath, artifactName).text;
	}

	private entry(
		databasePath: string,
		artifactName: string,
	): ObservationCacheEntry {
		const path = `${databasePath}:${artifactName}`;
		this.dropReplaced(databasePath);
		let entry = this.entries.get(path);
		if (entry) {
			this.entries.delete(path);
			this.entries.set(path, entry);
		} else {
			const statistics = this.statistics.get(path);
			if (!statistics)
				throw new Error(
					`Missing statistics selector for ${artifactName}.`,
				);
			const text = readStatisticsObservationText(
				databasePath,
				statistics.selector,
				statistics.artifact,
			);
			entry = {
				text,
				views: new Map(),
				bytes: Buffer.byteLength(text) + text.length * 2,
			};
			if (entry.bytes <= this.maxBytes) {
				while (this.bytes + entry.bytes > this.maxBytes) {
					const oldest = this.entries.keys().next().value!;
					this.bytes -= this.entries.get(oldest)!.bytes;
					this.entries.delete(oldest);
				}
				this.entries.set(path, entry);
				this.bytes += entry.bytes;
			}
		}
		return entry;
	}

	/** Forget what was read from a database file that has been replaced. */
	private dropReplaced(databasePath: string) {
		const generation = databaseGeneration(databasePath);
		if (this.generations.get(databasePath) === generation) return;
		this.generations.set(databasePath, generation);
		for (const [key, entry] of this.entries)
			if (key.startsWith(`${databasePath}:`)) {
				this.entries.delete(key);
				this.bytes -= entry.bytes;
			}
	}

	read(
		databasePath: string,
		artifactName: string,
		measureId: string,
	): AnyMeasureObservationArtifact {
		const entry = this.entry(databasePath, artifactName);
		const artifact: MeasureTableArtifact | AnyMeasureObservationArtifact =
			entry.artifact ?? JSON.parse(entry.text);
		entry.artifact = artifact;
		if (!isMeasureTable(artifact)) return artifact;
		let view = entry.views.get(measureId);
		if (!view) {
			view = tableMeasureObservations(artifact, measureId);
			entry.views.set(measureId, view);
		}
		return view;
	}
}

/**
 * A measure source's observations that are read when first used, shaped like
 * the artifact they stand for. What the catalogue already says (the measure
 * and the source's geography) is held up front, so finding the artifact for a
 * request reads nothing; its content hash and periods use the shared cache.
 * Reading every artifact before listening cost seconds of start-up and held
 * every measure in memory, though a request touches few of them. A missing
 * artifact still stops the server starting; one that is malformed or does not
 * match the catalogue is refused when read.
 */
export const lazySourceObservations = (
	databasePath: string,
	artifactName: string,
	measureId: string,
	sourceGeography: SourceGeography,
	cache: ObservationCache = new ObservationCache(),
): AnyMeasureObservationArtifact => {
	const path = `${databasePath}:${artifactName}`;
	if (!cache.has(databasePath, artifactName))
		throw new Error(`Missing measure observations at ${path}`);
	const load = () => {
		const observations = cache.read(databasePath, artifactName, measureId);
		if (
			observations.schemaVersion !== 1 ||
			observations.measureId !== measureId ||
			observations.sourceGeography.type !== sourceGeography.type ||
			observations.sourceGeography.boundaryYear !==
				sourceGeography.boundaryYear ||
			!Array.isArray(observations.periods)
		)
			throw new Error(`Invalid measure observations at ${path}`);
		return observations;
	};
	// Keys are in an artifact's own order, which its content hash depends on
	// where the artifact is hashed as it was written.
	const view: AnyMeasureObservationArtifact = {
		schemaVersion: 1,
		get contentHash() {
			return load().contentHash;
		},
		measureId,
		sourceGeography,
		get periods() {
			return load().periods;
		},
	} as AnyMeasureObservationArtifact;
	loaderOfView.set(view, load);
	textOfView.set(view, () => cache.text(databasePath, artifactName));
	return view;
};
