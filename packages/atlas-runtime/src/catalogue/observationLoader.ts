import { readFileSync } from "node:fs";
import {
	atlasDatabasePath,
	statisticsReadPathPath,
} from "../storage/dataLayout";
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

/**
 * Every measure's observations. Driven by the catalogue rather than a
 * hardcoded list, so publishing a measure needs no change here. Each is read
 * from SQLite when first used.
 */
export const readMeasureObservations = (
	repositoryRoot: string,
	dataCatalog: DataCatalog,
	maxBytes = DEFAULT_OBSERVATION_CACHE_BYTES,
	readPath: StatisticsReadPath = JSON.parse(
		readFileSync(statisticsReadPathPath(repositoryRoot), "utf8"),
	) as StatisticsReadPath,
): AnyMeasureObservationArtifact[] => {
	const databasePath = atlasDatabasePath(repositoryRoot);
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
