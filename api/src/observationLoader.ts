import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	isLegacyPopulationSource,
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type DataCatalog,
	type PopulationLocalAuthorityObservationArtifact,
	type PopulationObservationArtifact,
} from "./dataCatalog";
import {
	readSourceObservations,
	type MeasureTableArtifact,
} from "./observationTables";

export const readPopulationObservations = (
	apiRoot: string,
): PopulationObservationArtifact => {
	const path = join(apiRoot, "public", "population-observations.json");
	const observations = JSON.parse(
		readFileSync(path, "utf8"),
	) as PopulationObservationArtifact;
	if (
		observations.schemaVersion !== 1 ||
		observations.measureId !== "population-estimate" ||
		observations.period !== "2022" ||
		!Array.isArray(observations.records)
	) {
		throw new Error(`Invalid population observations at ${path}`);
	}
	return observations;
};

export const readPopulationLocalAuthorityObservations = (
	apiRoot: string,
): PopulationLocalAuthorityObservationArtifact => {
	const path = join(
		apiRoot,
		"public",
		"population-local-authority-observations.json",
	);
	const observations = JSON.parse(
		readFileSync(path, "utf8"),
	) as PopulationLocalAuthorityObservationArtifact;
	if (
		observations.schemaVersion !== 1 ||
		observations.measureId !== "population-estimate" ||
		observations.sourceGeography.type !== "localAuthority" ||
		!Array.isArray(observations.periods)
	) {
		throw new Error(
			`Invalid local-authority population observations at ${path}`,
		);
	}
	return observations;
};

/**
 * Every measure's observations except the two population artifacts, which
 * predate the convention. Driven by the catalogue rather than a hardcoded
 * list, so publishing a measure needs no change here.
 */
export const readMeasureObservations = (
	apiRoot: string,
	dataCatalog: DataCatalog,
): AnyMeasureObservationArtifact[] => {
	// A table serves every measure that names it, so it is read once.
	const tables = new Map<string, MeasureTableArtifact>();
	return dataCatalog.measures.flatMap((measure) =>
		measure.sources
			.filter((source) => !isLegacyPopulationSource(measure.id, source))
			.map((source) => {
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
