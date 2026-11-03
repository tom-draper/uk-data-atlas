import { observationDatabasePath } from "../storage/atlasObservations";
import type { StatisticsReadPath } from "../storage/atlasStatisticsObservations";
import {
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type DataCatalog,
} from "@uk-data-atlas/measures";
import {
	lazySourceObservations,
	ObservationCache,
	DEFAULT_OBSERVATION_CACHE_BYTES,
} from "./observationTables";

/** No artifact read from the statistics tables. */
export const OBSERVATION_TABLES_ONLY: StatisticsReadPath = {
	schemaVersion: 1,
	statistics: {},
	observations: {},
};

/**
 * Every measure's observations. Driven by the catalogue rather than a
 * hardcoded list, so publishing a measure needs no change here. Each is read
 * from SQLite when first used.
 */
export const readMeasureObservations = (
	repositoryRoot: string,
	dataCatalog: DataCatalog,
	maxBytes = DEFAULT_OBSERVATION_CACHE_BYTES,
	readPath: StatisticsReadPath = OBSERVATION_TABLES_ONLY,
): AnyMeasureObservationArtifact[] => {
	const databasePath = observationDatabasePath(repositoryRoot);
	const tables = new ObservationCache(maxBytes);
	tables.bindCatalogue(databasePath, dataCatalog, readPath);
	return dataCatalog.measures.flatMap((measure) =>
		measure.sources.map((source) =>
			lazySourceObservations(
				databasePath,
				observationArtifactName(measure.id, source),
				measure.id,
				source.sourceGeography,
				tables,
			),
		),
	);
};
