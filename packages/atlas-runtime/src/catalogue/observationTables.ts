import {
	assertObservationCatalogue,
	readObservationInventory,
	readObservationText,
} from "../storage/atlasObservations";
import type {
	DataCatalog,
	AnyMeasureObservationArtifact,
	MeasureObservationArtifact,
	PopulationObservation,
	SourceGeography,
} from "@uk-data-atlas/measures";

import {
	isMeasureTable,
	type MeasureTableArtifact,
} from "@uk-data-atlas/measures";
export {
	isMeasureTable,
	type MeasureTableArtifact,
} from "@uk-data-atlas/measures";

/** The table each measure's view was taken from. */
const tableOfView = new WeakMap<object, MeasureTableArtifact>();

/** What each lazily read view reads, and so stands for, when asked. */
const loaderOfView = new WeakMap<object, () => AnyMeasureObservationArtifact>();
const textOfView = new WeakMap<object, () => string>();

/** Exact stored bytes for a lazy SQLite artifact, including shared tables. */
export const observationTextOf = (artifact: object): string | undefined =>
	textOfView.get(artifact)?.();

import { registerPeriodRecordLookup } from "@uk-data-atlas/measures";
export { periodRecordLookup } from "@uk-data-atlas/measures";

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
	private readonly inventories = new Map<
		string,
		ReturnType<typeof readObservationInventory>
	>();

	constructor(private readonly maxBytes = DEFAULT_OBSERVATION_CACHE_BYTES) {
		if (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
			throw new Error(
				"Observation cache bytes must be a non-negative safe integer",
			);
	}

	bindCatalogue(databasePath: string, catalog: DataCatalog) {
		this.inventories.set(
			databasePath,
			assertObservationCatalogue(databasePath, catalog),
		);
	}

	private inventory(databasePath: string) {
		let inventory = this.inventories.get(databasePath);
		if (!inventory) {
			inventory = readObservationInventory(databasePath);
			this.inventories.set(databasePath, inventory);
		}
		return inventory;
	}

	has(databasePath: string, artifactName: string): boolean {
		return this.inventory(databasePath).names.has(artifactName);
	}

	text(databasePath: string, artifactName: string): string {
		return this.entry(databasePath, artifactName).text;
	}

	private entry(
		databasePath: string,
		artifactName: string,
	): ObservationCacheEntry {
		const path = `${databasePath}:${artifactName}`;
		let entry = this.entries.get(path);
		if (entry) {
			this.entries.delete(path);
			this.entries.set(path, entry);
		} else {
			const text = readObservationText(
				databasePath,
				artifactName,
				this.inventory(databasePath).generationHash,
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
 * Read the observations a measure source names from SQLite,
 * whether the artifact is the measure's own or a table it shares. Tables are
 * read once per cache, however many of their measures are asked for.
 */
export const readSourceObservations = (
	databasePath: string,
	artifactName: string,
	measureId: string,
	tables: Map<string, MeasureTableArtifact> = new Map(),
): AnyMeasureObservationArtifact => {
	const cached = tables.get(artifactName);
	if (cached) return tableMeasureObservations(cached, measureId);
	const parsed = JSON.parse(
		readObservationText(databasePath, artifactName),
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
