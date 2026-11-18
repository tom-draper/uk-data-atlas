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
): AnyMeasureObservationArtifact[] => {
	const databasePath = atlasDatabasePath(repositoryRoot);
	const tables = new ObservationCache(maxBytes);
	tables.bindCatalogue(databasePath, dataCatalog, readPath);
	const bySeriesSource = new Map<string, AnyMeasureObservationArtifact>();
	const observations = dataCatalog.measures.flatMap((measure) =>
		measure.sources.map((source) => {
			const identity = measure.series;
			if (!identity)
				throw new Error(`Missing series identity for ${measure.id}.`);
			const view = lazySourceObservations(
				databasePath,
				measureSeriesSourceKey(identity, source),
				measure.id,
				source.sourceGeography,
				tables,
				measureSeriesKey(identity),
			);
			bySeriesSource.set(measureSeriesSourceKey(identity, source), view);
			return view;
		}),
	);
	registerSeriesObservations(observations, bySeriesSource);
	return observations;
};
