import { join } from "node:path";
import {
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type DataCatalog,
} from "./dataCatalog";
import {
	lazySourceObservations,
	type MeasureTableArtifact,
} from "./observationTables";

/**
 * Every measure's observations. Driven by the catalogue rather than a
 * hardcoded list, so publishing a measure needs no change here. Each is read
 * from its file when first used.
 */
export const readMeasureObservations = (
	apiRoot: string,
	dataCatalog: DataCatalog,
): AnyMeasureObservationArtifact[] => {
	// A table serves every measure that names it, so it is read once.
	const tables = new Map<string, MeasureTableArtifact>();
	return dataCatalog.measures.flatMap((measure) =>
		measure.sources.map((source) =>
			lazySourceObservations(
				join(apiRoot, "public"),
				observationArtifactName(measure.id, source),
				measure.id,
				source.sourceGeography,
				tables,
			),
		),
	);
};
