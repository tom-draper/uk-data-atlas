import { observationDatabasePath } from "../storage/atlasObservations";
import {
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type DataCatalog,
} from "./dataCatalog";
import {
	lazySourceObservations,
	ObservationCache,
	DEFAULT_OBSERVATION_CACHE_BYTES,
} from "./observationTables";

/**
 * Every measure's observations. Driven by the catalogue rather than a
 * hardcoded list, so publishing a measure needs no change here. Each is read
 * from SQLite when first used.
 */
export const readMeasureObservations = (
	apiRoot: string,
	dataCatalog: DataCatalog,
	maxBytes = DEFAULT_OBSERVATION_CACHE_BYTES,
): AnyMeasureObservationArtifact[] => {
	const databasePath = observationDatabasePath(apiRoot);
	const tables = new ObservationCache(maxBytes);
	tables.bindCatalogue(databasePath, dataCatalog);
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
