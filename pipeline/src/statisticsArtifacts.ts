import type { DatabaseSync } from "node:sqlite";
import {
	observationArtifactName,
	type DataCatalog,
	type MeasureSource,
} from "@uk-data-atlas/measures";
import {
	rebuildStatisticsObservationText,
	type StatisticsReadPath,
} from "@uk-data-atlas/atlas-runtime/storage";

export const statisticsArtifactReader = (
	database: DatabaseSync,
	catalog: DataCatalog,
	readPath: StatisticsReadPath,
) => {
	const names = new Set<string>();
	const datasets = new Set(catalog.datasets.map((dataset) => dataset.id));
	for (const measure of catalog.measures) {
		for (const source of measure.sources) {
			const name = observationArtifactName(measure.id, source);
			if (!datasets.has(source.datasetId))
				throw new Error(
					`The data catalogue has no ${source.datasetId} dataset.`,
				);
			if (!readPath.statistics[name])
				throw new Error(`Missing statistics selector for ${name}.`);
			names.add(name);
		}
	}
	for (const name of Object.keys(readPath.statistics))
		if (!names.has(name))
			throw new Error(`Unexpected statistics selector: ${name}.`);
	for (const name of Object.keys(readPath.observations))
		throw new Error(`Artifact ${name} has no statistics read path.`);
	return (measureId: string, source: MeasureSource) => {
		const name = observationArtifactName(measureId, source);
		const selector = readPath.statistics[name];
		if (!selector)
			throw new Error(`Missing statistics selector for ${name}.`);
		return rebuildStatisticsObservationText(database, selector, {
			measureId,
			sourceGeography: source.sourceGeography,
			periods: source.periods,
		});
	};
};
