import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import { readAtlasStatisticsReadPath } from "./atlasStatisticsReadPath.ts";
import type { StatisticsReadPath } from "./atlasStatisticsObservations.ts";
import {
	measureSeriesSourceKey,
	measureSeriesKey,
	registerSeriesObservations,
	type AnyMeasureObservationArtifact,
	type DataCatalog,
} from "./index.ts";
import {
	lazySourceObservations,
	ObservationCache,
	DEFAULT_OBSERVATION_CACHE_BYTES,
} from "./observationTables.ts";

type ObservationExport = {
	measureId: string;
	contentHash: string;
	datasetId: string;
	sourceGeography: { type: string; boundaryYear: number };
	periods: readonly string[];
};

const exportKey = (
	id: string,
	source: Pick<ObservationExport, "datasetId" | "sourceGeography">,
) =>
	JSON.stringify([
		id,
		source.datasetId,
		source.sourceGeography.type,
		source.sourceGeography.boundaryYear,
	]);

/**
 * Every measure's observations. Driven by the catalogue rather than a
 * hardcoded list, so publishing a measure needs no change here. Each is read
 * from SQLite when first used.
 */
export const readMeasureObservations = (
	repositoryRoot: string,
	dataCatalog: DataCatalog,
	maxBytes = DEFAULT_OBSERVATION_CACHE_BYTES,
	readPath: StatisticsReadPath = readAtlasStatisticsReadPath(
		atlasDatabasePath(repositoryRoot),
	),
	exports: readonly ObservationExport[] = [],
): AnyMeasureObservationArtifact[] => {
	const databasePath = atlasDatabasePath(repositoryRoot);
	const tables = new ObservationCache(maxBytes);
	tables.bindCatalogue(databasePath, dataCatalog, readPath);
	const exportsBySource = new Map(
		exports.map((entry) => [exportKey(entry.measureId, entry), entry]),
	);
	const bySeriesSource = new Map<string, AnyMeasureObservationArtifact>();
	const observations = dataCatalog.measures.flatMap((measure) =>
		measure.sources.map((source) => {
			const identity = measure.series;
			if (!identity)
				throw new Error(`Missing series identity for ${measure.id}.`);
			const key = measureSeriesSourceKey(identity, source);
			const view = lazySourceObservations(
				databasePath,
				key,
				measure.id,
				source.sourceGeography,
				tables,
				measureSeriesKey(identity),
			);
			const entry = exportsBySource.get(exportKey(measure.id, source));
			if (
				entry &&
				entry.periods.length === source.periods.length &&
				source.periods.every(
					(period, index) => period === entry.periods[index],
				)
			)
				tables.registerIndexedRead(
					view,
					databasePath,
					key,
					entry.contentHash,
				);
			bySeriesSource.set(key, view);
			return view;
		}),
	);
	registerSeriesObservations(observations, bySeriesSource);
	return observations;
};
