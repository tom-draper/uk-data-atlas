import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type DataCatalog,
} from "./dataCatalog";
import {
	readSourceObservations,
	type MeasureTableArtifact,
} from "./observationTables";

/**
 * Every measure's observations. Driven by the catalogue rather than a
 * hardcoded list, so publishing a measure needs no change here.
 */
export const readMeasureObservations = (
	apiRoot: string,
	dataCatalog: DataCatalog,
): AnyMeasureObservationArtifact[] => {
	// A table serves every measure that names it, so it is read once.
	const tables = new Map<string, MeasureTableArtifact>();
	return dataCatalog.measures.flatMap((measure) =>
		measure.sources.map((source) => {
			const name = observationArtifactName(measure.id, source);
			const path = join(apiRoot, "public", `${name}.json`);
			const observations = readSourceObservations(
				join(apiRoot, "public"),
				name,
				measure.id,
				tables,
			);
			if (
				observations.schemaVersion !== 1 ||
				observations.measureId !== measure.id ||
				observations.sourceGeography.type !==
					source.sourceGeography.type ||
				observations.sourceGeography.boundaryYear !==
					source.sourceGeography.boundaryYear ||
				!Array.isArray(observations.periods)
			) {
				throw new Error(`Invalid measure observations at ${path}`);
			}
			return observations;
		}),
	);
};
